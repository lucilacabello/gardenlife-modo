import React from "react";
import {
  reactExtension,
  Text,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.thank-you.render-after", () => {
  return <Text>MODO Test Minimal</Text>;
});

