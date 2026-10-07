import '@shopify/ui-extensions/preact';
import {render} from "preact";
import { useEffect, useState } from 'preact/hooks';

export default async () => {
  render(<Extension />, document.body);
};

const VOLUMETRIC_DIVISOR = 5000; // cm³ per kg, confirm with your carrier
const KG_PER_M3 = 1_000_000 / VOLUMETRIC_DIVISOR; // 200

const boxVolumesAndMeasurements = {
  envelope: {
    name: 'Sobre',
    volume: 0.0078,
    measurements: '0,05 × 0,45 × 0,35 m',
    volumetricKg: 0.0078 * KG_PER_M3, // 1.56
  },
  small: {
    name: 'Caja pequeña',
    volume: 0.036,
    measurements: '0,15 × 0,4 × 0,6 m',
    volumetricKg: 0.036 * KG_PER_M3, // 7.2
  },
  medium: {
    name: 'Caja mediana',
    volume: 0.072,
    measurements: '0,3 × 0,4 × 0,6 m',
    volumetricKg: 0.072 * KG_PER_M3, // 14.4
  },
  big: {
    name: 'Caja grande',
    volume: 0.096,
    measurements: '0,4 × 0,4 × 0,6 m',
    volumetricKg: 0.096 * KG_PER_M3, // 19.2
  },
};

const WEIGHT_QUERY = `
  query getVariantWeights($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        weight
        weightUnit
        product {
          title
        }
        volumen: metafield(namespace: "custom", key: "volumen") {
          value
          type
        }
      }
    }
  }
`;


function Extension() {
  const [products, setProducts] = useState([])



  useEffect(() => {
    const ids = [
      ...new Set(shopify.lines.value.map((line) => line.merchandise.id)),
    ];

    if (!ids.length) return;

    let cancelled = false;

    const fetchWeights = async () => {
      try {
        const {data, errors} = await shopify.query(WEIGHT_QUERY, {
          variables: {ids},
        });

        if (cancelled) return;

        if (errors?.length) {
          console.error("Weight query errors", errors);
          return;
        }

        const nodes = (data?.nodes ?? []).filter(Boolean);

        // Build a lookup once: variant ID -> variant data
        const variantsById = new Map(nodes.map((v) => [v.id, v]));

        // Match each cart line to its variant
        const matched = shopify.lines.value.map((line) => {
          const variant = variantsById.get(line.merchandise.id);
          return {
            lineId: line.id,
            quantity: line.quantity,
            variant: variant ?? null,
          };
        });

        setProducts(matched)
      } catch (err) {
        console.error("Failed to fetch variant weights", err);
      }
    };

    fetchWeights();

    return () => {
      cancelled = true;
    };
}, []);

  useEffect(() => {
    if (!products.length) return; // skip the initial empty render
  }, [products]);


  function getLineVolume(product) {
    const raw = product.variant?.volumen?.value;   // might be missing
    if (!raw) return 0;                            // no metafield -> no volume

    const volumePerUnit = JSON.parse(raw).value;   // string -> object -> number
    return volumePerUnit * product.quantity;
  }

  let totalVolumeOnCart = 0
  let orderTotalUnits = 0
  let finalVolume = 0
  let totalWeight = 0 

  let packagingSummary = {
    envelope : 0, 
    small: 0,
    medium: 0,
    big: 0, 
    total: 0,
    finalVolume: 0,
  }

  function calculatePackagingSummary(){
    let currentVolume = totalVolumeOnCart
    
    function pickNextBox() {
      const volumeOnSmallBox  = currentVolume - boxVolumesAndMeasurements.small.volume
      const volumeOnMediumBox = currentVolume - boxVolumesAndMeasurements.medium.volume
      const volumeOnBigBox    = currentVolume - boxVolumesAndMeasurements.big.volume
      const volumeOnEnvelope = currentVolume - boxVolumesAndMeasurements.envelope.volume

      if (volumeOnEnvelope <= 0)  return { box: 'envelope',  leftoverVolume: volumeOnEnvelope }
      if (volumeOnSmallBox <= 0)  return { box: 'small',  leftoverVolume: volumeOnSmallBox }
      if (volumeOnMediumBox <= 0) return { box: 'medium', leftoverVolume: volumeOnMediumBox }
      return { box: 'big', leftoverVolume: volumeOnBigBox }
    }

    while (currentVolume > 0 ){
      const {box, leftoverVolume} = pickNextBox()
      packagingSummary.total =  packagingSummary.total + 1
      packagingSummary[box] =   packagingSummary[box] + 1
      currentVolume = leftoverVolume
    }
    packagingSummary.finalVolume = currentVolume
    return packagingSummary
  }

  products.forEach((product) => {
    totalVolumeOnCart = totalVolumeOnCart + getLineVolume(product)
    orderTotalUnits = orderTotalUnits + product.quantity
    totalWeight = totalWeight + (product.variant.weight * product.quantity )  
  });

    calculatePackagingSummary()

  let totalVolumetricWeight = `${(
  (packagingSummary.small * boxVolumesAndMeasurements.small.volumetricKg) +
  (packagingSummary.medium * boxVolumesAndMeasurements.medium.volumetricKg) +
  (packagingSummary.big * boxVolumesAndMeasurements.big.volumetricKg))} kg`

  totalWeight = (totalWeight /1000) + ' kg'



  console.group("cart summary")
    console.log("products", products)
    console.log("total units", orderTotalUnits)
    console.log("total volume (m³)", totalVolumeOnCart)
    console.log("total weight : ", totalWeight)

    console.group("volume per line")
      console.table(
        products.map((product) => ({
          lineId: product.lineId,
          product: product.variant?.product?.title,
          variant: product.variant?.title,
          quantity: product.quantity,
          rawMetafield: product.variant?.volumen?.value,
          volumePerLine: getLineVolume(product),
        }))
      )
    console.groupEnd()

      console.group("packaging")
        console.log("remaining after first big box (m³)", totalVolumeOnCart - boxVolumesAndMeasurements.big.volume)
        console.log("final volume", packagingSummary.finalVolume)
        console.log("packagingSummary", { ...packagingSummary })
        console.table({
          small:  { count: packagingSummary.small,  volumeEach: boxVolumesAndMeasurements.small.volume,  volumetricKgEach: boxVolumesAndMeasurements.small.volumetricKg },
          medium: { count: packagingSummary.medium, volumeEach: boxVolumesAndMeasurements.medium.volume, volumetricKgEach: boxVolumesAndMeasurements.medium.volumetricKg },
          big:    { count: packagingSummary.big,    volumeEach: boxVolumesAndMeasurements.big.volume,    volumetricKgEach: boxVolumesAndMeasurements.big.volumetricKg },
        })
      console.groupEnd()

    console.log("total volumetric weight", totalVolumetricWeight)
    console.log("constants", { VOLUMETRIC_DIVISOR, KG_PER_M3 })
  console.groupEnd()


  // UI 
  const { 
    section_header,
    number_of_bulks_image,
    number_of_bulks_label,
    number_of_units_image,
    number_of_units_label,
    volumetric_weight_image,
    volumetric_weight_label,
    } = shopify.settings.value;
  
  const {
    envelope_image, envelope_label,
    small_box_image, small_box_label,
    medium_box_image, medium_box_label,
    big_box_image, big_box_label,
  } = shopify.settings.value

  const renderImageBox = (image_url, item_label, calculatedValue) =>{
    return(
        <s-grid
              gridTemplateColumns="65px 1fr"
              padding="none"
              alignItems='baseline'>
                <s-grid-item borderStyle="dashed">
                  <s-box inlineSize="60px">
                      <s-image
                        src={ image_url}
                        alt="Indoor plant product photo"
                        aspectRatio="1/1"
                        objectFit="cover"
                        borderRadius="base"
                        inlineSize="fill">
                      </s-image>
                    </s-box>
                </s-grid-item>
                <s-grid-item borderStyle="dashed">
                  <s-box minInlineSize='100%'>
                    <s-grid 
                      accessibilityLabel="Product listing" 
                      gridTemplateColumns="1fr auto" 
                      alignContent='start'
                      justifyContent='start'>
                      <s-grid-item gridColumn="span 2">
                        <s-text>{item_label}</s-text>
                      </s-grid-item>
                      <s-grid-item gridColumn="span 2">
                        <s-text>{calculatedValue? calculatedValue : 'Sample Text'}</s-text>
                      </s-grid-item>
                    </s-grid>
                  </s-box>
                </s-grid-item>
        </s-grid>
    )
  }

  return (
    <s-grid
      gridTemplateColumns="1fr 1fr"
      gap="large"
      maxBlockSize='100%'
      placeItems="start"
    >
      {renderImageBox(number_of_bulks_image, number_of_bulks_label, packagingSummary.total)}
      {renderImageBox(number_of_units_image, number_of_units_label, orderTotalUnits)}
      {renderImageBox(volumetric_weight_image,volumetric_weight_label,totalWeight)}
      
      { packagingSummary.envelope > 0 ?  renderImageBox(envelope_image,envelope_label, `${boxVolumesAndMeasurements.envelope.measurements} * ${packagingSummary.envelope}`, ): null}

      { packagingSummary.small > 0 ?  renderImageBox(small_box_image,small_box_label, `${boxVolumesAndMeasurements.small.measurements} * ${packagingSummary.small}`, ): null}
      
      { packagingSummary.medium > 0 ?  renderImageBox(medium_box_image,medium_box_label, `${boxVolumesAndMeasurements.medium.measurements} * ${packagingSummary.medium}`, ): null}
      
      { packagingSummary.big > 0 ?  renderImageBox(big_box_image,big_box_label, `${boxVolumesAndMeasurements.big.measurements} * ${packagingSummary.big}`, ): null}
    </s-grid>
  );
}