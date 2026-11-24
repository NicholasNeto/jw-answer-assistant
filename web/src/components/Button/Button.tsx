import "./Button.css";
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export default function Button({
  variant,
  className = "",
  ...rest
}: ButtonProps) {
  const cls = ["btn", variant, className].filter(Boolean).join(" ");
  return <button className={cls} {...rest} />;
}
