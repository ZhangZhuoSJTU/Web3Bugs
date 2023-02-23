import { create } from "@storybook/theming"

export default create({
  base: "light",

  colorPrimary: "#6264D8",
  colorSecondary: "#14154F",

  // UI
  appBg: "white",
  appContentBg: "white",
  appBorderColor: "grey",
  appBorderRadius: 4,

  // Typography
  fontBase: '"Open Sans", sans-serif',
  fontCode: "monospace",

  // Text colors
  textColor: "black",
  textInverseColor: "rgba(255,255,255,0.9)",

  // Toolbar default and active colors
  barTextColor: "#000000",
  barSelectedColor: "black",
  barBg: "#6264D8",

  // Form colors
  inputBg: "white",
  inputBorder: "silver",
  inputTextColor: "black",
  inputBorderRadius: 4,

  brandTitle: "prePO",
  brandUrl: "https://prepo.io",
  brandImage:
    "https://mb.cision.com/Public/16327/logo/bc66dc11f49b790c_org.jpg",
})
