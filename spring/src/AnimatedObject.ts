import {
  Animated,
  type AnimatedValue,
  getPayload,
  isAnimated,
} from './animated'
import { TreeContext } from './context'
import { getFluidValue, hasFluidValue } from './fluids'
import { type Lookup, eachProp, each } from './utils'

/** An object containing `Animated` nodes */
export class AnimatedObject extends Animated {
  constructor(protected source: Lookup) {
    super()
    this.setValue(source)
  }

  getValue(animated?: boolean) {
    const values: Lookup = {}
    eachProp(this.source, (source, key) => {
      if (isAnimated(source)) {
        values[key] = source.getValue(animated)
      } else if (hasFluidValue(source)) {
        values[key] = getFluidValue(source)
      } else if (!animated) {
        values[key] = source
      }
    })
    return values
  }

  /** Replace the raw object data */
  setValue(source: Lookup) {
    this.source = source
    this.payload = this._makePayload(source)
  }

  reset() {
    if (this.payload) {
      each(this.payload, (node) => node.reset())
    }
  }

  /** Create a payload set. */
  protected _makePayload(source: Lookup) {
    if (source) {
      const payload = new Set<AnimatedValue>()
      eachProp(source, this._addToPayload, payload)
      return Array.from(payload)
    }
  }

  /** Add to a payload set. */
  protected _addToPayload(this: Set<AnimatedValue>, source: any) {
    if (TreeContext.dependencies && hasFluidValue(source)) {
      TreeContext.dependencies.add(source)
    }
    const payload = getPayload(source)
    if (payload) {
      each(payload, (node) => this.add(node))
    }
  }
}
