import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border text-card-foreground transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-px hover:shadow-md hover:border-primary/30",
      className
    )}
    style={{
      background: "hsl(var(--card) / 0.88)",
      borderColor: "hsl(var(--border) / 0.65)",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      backdropFilter: "blur(10px)",
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
