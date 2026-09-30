import '@shopify/ui-extensions/preact';
import {render} from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  // Keys must match the ones in shopify.extension.toml
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

  const renderImageBox = (image_url, item_label) =>{
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
                        <s-text>Sample Text</s-text>
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
      {renderImageBox(number_of_bulks_image, number_of_bulks_label )}
      {renderImageBox(number_of_units_image, number_of_units_label)}
      {renderImageBox(volumetric_weight_image,volumetric_weight_label)}
      {renderImageBox(box_image, box_label)}
    </s-grid>
  );

  // EXAMPLE CHANGE OF METAFIELD

  //   const freeGiftRequested = shopify.appMetafields.value.find(
  //   (appMetafield) =>
  //     appMetafield.target.type === "cart" &&
  //     appMetafield.metafield.namespace === "$app" &&
  //     appMetafield.metafield.key === "requestedFreeGift",
  // );

  // async function onCheckboxChange(event) {
  //   const isChecked = event.target.checked;
  //   const result = await shopify.applyMetafieldChange({
  //     type: "updateCartMetafield",
  //     metafield: {
  //       namespace: "$app",
  //       key: "requestedFreeGift",
  //       value: isChecked ? "true" : "false",
  //       type: "boolean",
  //     },
  //   });
  //   console.log("applyMetafieldChange result", result);
  // }
}