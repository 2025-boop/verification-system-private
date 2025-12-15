/**
 * Icon mapping utility for rendering Lucide icons from icon name strings.
 * This allows icon names to be stored in constants and rendered dynamically.
 */

import React from "react"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  X,
  RotateCcw,
  Lock,
  Info,
} from "lucide-react"

export type IconName =
  | "AlertCircle"
  | "ArrowLeft"
  | "Check"
  | "X"
  | "RotateCcw"
  | "Lock"
  | "Info"

type IconComponent = React.FC<React.SVGProps<SVGSVGElement> & { ref?: React.Ref<SVGSVGElement> }>

const ICON_MAP: Record<IconName, IconComponent> = {
  AlertCircle: AlertCircle as IconComponent,
  ArrowLeft: ArrowLeft as IconComponent,
  Check: Check as IconComponent,
  X: X as IconComponent,
  RotateCcw: RotateCcw as IconComponent,
  Lock: Lock as IconComponent,
  Info: Info as IconComponent,
}

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName | undefined
}

/**
 * Renders a Lucide icon by name string
 * Usage: <IconComponent name="Check" className="w-4 h-4" />
 */
export const IconComponent = React.forwardRef<SVGSVGElement, IconProps>(
  ({ name, className = "w-4 h-4", ...props }, ref) => {
    if (!name || !ICON_MAP[name]) {
      return null
    }

    const Icon = ICON_MAP[name]
    return <Icon ref={ref} className={className} {...props} />
  }
)

IconComponent.displayName = "IconComponent"
