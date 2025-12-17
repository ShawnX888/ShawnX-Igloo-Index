"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        // v9 class names
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "w-full",
        month_caption: "flex justify-center pt-1 relative items-center mb-4 h-7",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100 z-10"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100 z-10"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full justify-between",
        weekday: "text-muted-foreground font-normal text-[0.8rem] w-9 text-center",
        weeks: "h-[252px]",
        week: "flex w-full justify-between mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        range_start: "day-range-start rounded-l-md bg-primary text-primary-foreground",
        range_end: "day-range-end rounded-r-md bg-primary text-primary-foreground",
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground rounded-md",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "bg-accent text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className="size-4" {...chevronProps} />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
