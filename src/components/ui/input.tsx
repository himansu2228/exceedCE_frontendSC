import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onClick, onFocus, ...props }, ref) => {
    const internalRef = React.useRef<HTMLInputElement | null>(null)

    // Assign both the internal ref and forwarded ref
    const setRefs = (node: HTMLInputElement | null) => {
      internalRef.current = node;

      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };


    const openPickerIfDate = () => {
      if (type === 'date') {
        // `showPicker` is available on modern browsers to open the native date picker
        ;(internalRef.current as any)?.showPicker?.()
      }
    }

    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      onClick?.(e as any)
      openPickerIfDate()
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      onFocus?.(e as any)
      openPickerIfDate()
    }

    return (
      <input
       ref={setRefs}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-zinc-300/90 bg-white/90 px-3 py-2 text-sm ring-offset-background backdrop-blur-md file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onClick={handleClick}
        onFocus={handleFocus}
        {...(props as any)}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
