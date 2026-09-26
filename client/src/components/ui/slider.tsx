import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  thumbLabels?: string[];
  thumbClassNames?: string[];
  onThumbPointerDown?: (index: number) => void;
  onThumbKeyDown?: (index: number) => void;
  markFormatter?: (value: number) => string;
  trackFill?: {
    startPercent: number;
    endPercent: number;
    className?: string;
  };
};

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, thumbLabels, thumbClassNames, onThumbPointerDown, onThumbKeyDown, markFormatter, trackFill, ...props }, ref) => {
  const values = props.value ?? props.defaultValue;
  const thumbCount = Array.isArray(values) ? Math.max(values.length, 1) : 1;
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const step = props.step ?? 1;
  const marks = max > min
    ? Array.from({ length: 4 }, (_, index) => {
        const target = min + ((max - min) * index) / 3;
        const alignedValue = min + Math.round((target - min) / step) * step;
        const decimals = Math.min(6, Math.max(0, (String(step).split(".")[1] ?? "").length));
        const value = Number(Math.min(max, Math.max(min, alignedValue)).toFixed(decimals));
        return { value, label: markFormatter?.(value) ?? value.toLocaleString("en-US") };
      })
    : [];

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className,
        "pb-6",
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        {trackFill && (
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute h-full bg-primary", trackFill.className)}
            style={{
              left: `${trackFill.startPercent}%`,
              width: `${trackFill.endPercent - trackFill.startPercent}%`,
            }}
          />
        )}
        <SliderPrimitive.Range className={cn("absolute h-full bg-primary", trackFill && "hidden")} />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={thumbLabels?.[index]}
          onPointerDown={() => onThumbPointerDown?.(index)}
          onKeyDown={() => onThumbKeyDown?.(index)}
          className={cn(
            "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            thumbClassNames?.[index],
          )}
        />
      ))}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-5 text-[10px] leading-3 text-muted-foreground"
      >
        {marks.map((mark, index) => {
          const position = ((mark.value - min) / (max - min)) * 100;
          const labelPosition =
            index === 0
              ? "left-0"
              : index === marks.length - 1
                ? "right-0"
                : "left-1/2 -translate-x-1/2";

          return (
            <span
              key={`${mark.value}-${index}`}
              className="absolute top-0"
              style={{ left: `${position}%` }}
            >
              <span className="absolute left-0 top-0 h-1.5 w-px -translate-x-1/2 bg-muted-foreground/60" />
              <span className={cn("absolute top-1.5 whitespace-nowrap", labelPosition)}>
                {mark.label}
              </span>
            </span>
          );
        })}
      </span>
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
