import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border text-card-foreground transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-px hover:border-blue-300/50 hover:shadow-[0_22px_55px_-24px_rgba(37,99,235,0.28)]",
      className
    )}
    style={{
      background: "rgba(255,255,255,0.82)",
      borderColor: "rgba(228,228,231,0.75)",
      boxShadow: "0 14px 44px -26px rgba(15,23,42,0.3)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      ...style,
    }}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5", className)}
    style={{
      borderBottom: "1px solid hsl(var(--border) / 0.4)",
      ...style,
    }}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-base font-semibold leading-tight tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, style, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm", className)}
    style={{
      color: "hsl(var(--muted-foreground))",
      lineHeight: "1.6",
      ...style,
    }}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => {
  const {
    padding,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    ...safeStyle
  } = style || {}

  return (
    <div ref={ref} className={cn("px-6 pb-6 pt-4", className)} style={safeStyle} {...props} />
  )
})
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center px-6 pb-6", className)}
    style={{
      borderTop: "1px solid hsl(var(--border) / 0.2)",
      paddingTop: "1rem",
      marginTop: "0.5rem",
      ...style,
    }}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
