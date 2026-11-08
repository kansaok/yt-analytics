import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// DESIGN.md: tinggi 48px, radius kontrol 10px, primary isi teal, secondary border 1.5px.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-auto",
  {
    variants: {
      variant: {
        primary: "bg-sea-primary text-sea-on-primary hover:brightness-110 active:brightness-95",
        secondary:
          "border-[1.5px] border-sea-primary text-sea-primary bg-transparent hover:bg-sea-tint active:bg-sea-line/40",
        ghost: "text-sea-text hover:bg-sea-tint active:bg-sea-line/40",
        danger: "border-[1.5px] border-sea-danger text-sea-danger hover:bg-sea-danger/10 active:bg-sea-danger/20",
      },
      size: {
        md: "h-12 px-5 text-[15px]",
        sm: "h-11 px-4 text-sm",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
export { buttonVariants };
