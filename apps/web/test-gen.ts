import { generatePopupWithVariants } from './src/lib/popupGeneration';
async function main() {
  try {
    const res = await generatePopupWithVariants({
       domain: "test.com",
       category: "Retail",
       brandTokens: { palette: ["#000"], type_display: "Arial", type_body: "Arial", imagery_style: "none", signature_element_suggestion: "none" },
       existingPopup: { captured: false, screenshot_url: null, detected_type: null, transcript: null },
       computedStyles: { primaryColor: "#000", fontFamily: "Arial", hasBorderRadius: false },
       analyticsVariants: [],
       variantCount: 1,
       multivariate: false,
       goal: "BOTH"
    });
    console.log("SUCCESS");
  } catch (e) {
    console.error("FAILED:");
    console.error(e);
  }
}
main().finally(() => process.exit(0));
