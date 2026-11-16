// Lets a `style` prop set CSS variables, like `style={{ "--r": "-1deg" }}`.
import "react";

declare module "react" {
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined;
  }
}
