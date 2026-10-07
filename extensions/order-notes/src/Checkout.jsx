import '@shopify/ui-extensions/preact';
import {render} from "preact";
import {useState} from "preact/hooks";

export default async () => {
  render(<Extension />, document.body);
};

const NAMESPACE = "$app";
const KEY = "order_optional_notes";

function Extension() {
  const settings = shopify.settings.value;
  const header = settings.header || "Order notes";
  const placeholder = settings.placeholder || "Add any notes for your order (optional)";

  // Read the saved value only once, to pre-fill
  const saved = shopify.appMetafields.value.find(
    (m) =>
      m.target.type === "cart" &&
      m.metafield.namespace === NAMESPACE &&
      m.metafield.key === KEY,
  )?.metafield?.value;

  // Hooks must run before any early return
  const [text, setText] = useState(saved ?? "");

  if (!shopify.instructions.value.metafields.canSetCartMetafields) {
    return (
      <s-banner heading="order-notes" tone="warning">
        {shopify.i18n.translate("metafieldChangesAreNotSupported")}
      </s-banner>
    );
  }

  return (
    <s-stack gap="small-200">
      <s-heading>{header}</s-heading>
      <s-text-area
        labelAccessibilityVisibility="exclusive"
        label="Order notes (optional)"
        placeholder={placeholder}
        rows={3}
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
        onChange={save}
      />
    </s-stack>
  );

  async function save(event) {
    const value = event.currentTarget.value;

    const result = await shopify.applyMetafieldChange(
      value.trim() === ""
        ? { type: "removeCartMetafield", namespace: NAMESPACE, key: KEY }
        : {
            type: "updateCartMetafield",
            metafield: {
              namespace: NAMESPACE,
              key: KEY,
              value,
              type: "multi_line_text_field",
            },
          },
    );
    console.log("applyMetafieldChange result", result);
  }
}