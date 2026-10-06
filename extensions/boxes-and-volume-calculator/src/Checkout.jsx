import '@shopify/ui-extensions/preact';
import {render} from "preact";
import { useEffect, useState } from 'preact/hooks';

export default async () => {
  render(<Extension />, document.body);
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
  const [totalWeight, setTotalWeight] = useState(0)
  const [totalUnits, setTotalUnits] = useState(0)
  const [totalVolumeOnCart, setToTalVolumeOnCart] = useState(0)
  const [boxesSummary, setBoxesSummary] = useState()

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

    const getTotalOrderVolumetricBulk = () =>{
      
      let unitCount = 0 
      let totalVolume = 0 
      
      products.forEach(product => { 
        console.log("product", product.quantity)
        unitCount = unitCount + product.quantity
        totalVolume = (JSON.parse(product.variant.volumen.value).value * product.quantity ) + totalVolume
      })
      setToTalVolumeOnCart(totalVolume)
      setTotalUnits(unitCount)
    }

    const calculateBoxTotal = ()=>{
      // always 1 big box as an innitial box 

      let currentTotalVolume = totalVolumeOnCart

      const pickNextBox = (remainingVolume)=>{
        const nextBox = {
          size : ``,
          leftOverSpace : 0,
        }

        let againstSmallBox = remainingVolume - boxVolumesAndMeasurements.small.volume
        let againstMediumBox = remainingVolume - boxVolumesAndMeasurements.medium.volume
        let againstBigBox = remainingVolume - boxVolumesAndMeasurements.big.volume
      
        if(againstSmallBox < 0){
          nextBox.size = 'small'
          nextBox.leftOverSpace = againstSmallBox
        }else if (againstMediumBox < 0){
          nextBox.size = 'medium'
          nextBox.leftOverSpace = againstMediumBox
        }else{
          nextBox.size = 'big'
          nextBox.leftOverSpace = againstBigBox
        }
        
        return nextBox
      }

      let total_box_summary = {
        small: 0,
        medium: 0,
        big: 1,
        envelope: 0,
        total_boxes: 1
      }
      // stop counting if volume fits on a singular big box
      if(totalVolumeOnCart < boxVolumesAndMeasurements.big.volume){
        console.log("total box summary", total_box_summary)
        setBoxesSummary(total_box_summary)
        return total_box_summary
      }

      currentTotalVolume = currentTotalVolume - boxVolumesAndMeasurements.big.volume

      while(currentTotalVolume > 0){
        const { leftOverSpace, size } = pickNextBox(currentTotalVolume)
        total_box_summary[size] = total_box_summary[size] + 1
        currentTotalVolume = leftOverSpace 
        total_box_summary.total_boxes = total_box_summary.total_boxes + 1
        console.log("loop continues...")
      }

      console.groupCollapsed("summary")
        console.log("box summary", total_box_summary )
        console.log("leftover space", currentTotalVolume)
      console.groupEnd()


      return total_box_summary
    }

    const newBoxSummary = calculateBoxTotal()

    getTotalOrderVolumetricBulk()
    setBoxesSummary(newBoxSummary)

    if (!products.length) return; // skip the initial empty render

    console.log("products changed", products);
    console.log("total units", totalUnits)
    console.log("total volume on cart ", totalVolumeOnCart)
    console.log("box summary state", boxesSummary)
  
  }, [products, totalUnits]);


  // UI 
  const { 
    section_header,
    number_of_bulks_image,
    number_of_bulks_label,
    number_of_units_image,
    number_of_units_label,
    volumetric_weight_image,
    volumetric_weight_label,
    box_image,
    box_label,
    } = shopify.settings.value;

  const renderImageBox = (image_url, item_label, calculatedValue) =>{
    return(
        <s-grid
              gridTemplateColumns="1fr 1fr"
              padding="none"
              alignItems='baseline'>
                <s-grid-item borderStyle="dashed">
                  <s-box inlineSize="75px">
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
                      alignContent='center'>
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
      {renderImageBox(number_of_bulks_image, number_of_bulks_label)}
      {renderImageBox(number_of_units_image, number_of_units_label, totalUnits)}
      {renderImageBox(volumetric_weight_image,volumetric_weight_label)}
      {renderImageBox(box_image, box_label)}
    </s-grid>
  );
}