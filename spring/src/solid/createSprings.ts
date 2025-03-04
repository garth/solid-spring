import {
  type ControllerFlushFn,
  type ControllerUpdate,
  detachRefs,
  is,
  type Lookup,
  type PickAnimated,
  replaceRef,
  type SpringValues,
} from '../utils'
import { SpringRef } from '../SpringRef'
import type { SpringRef as SpringRefType } from '../SpringRef'
import { each } from '../utils'
import {
  Controller,
  flushUpdateQueue,
  getSprings,
  setSprings,
} from '../Controller'
import {
  type Accessor,
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  onCleanup,
} from 'solid-js'
import { declareUpdate } from '../SpringValue'

export type CreateSpringsProps<State extends Lookup = Lookup> =
  ControllerUpdate<State> & {
    ref?: SpringRefType<State>
  }

export function createSprings<Props extends CreateSpringsProps>(
  lengthFn: number | (() => number),
  props: Props[] & CreateSpringsProps<PickAnimated<Props>>[],
): Accessor<SpringValues<PickAnimated<Props>>[]> & {
  ref: SpringRefType<PickAnimated<Props>>
}

export function createSprings<Props extends CreateSpringsProps>(
  lengthFn: number | (() => number),
  props: (i: number, ctrl: Controller) => Props,
): Accessor<SpringValues<PickAnimated<Props>>[]> & {
  ref: SpringRefType<PickAnimated<Props>>
}

export function createSprings<Props extends CreateSpringsProps>(
  lengthFn: any,
  props: any[] | ((i: number, ctrl: Controller) => any),
): Accessor<SpringValues<PickAnimated<Props>>[]> & {
  ref: SpringRefType<PickAnimated<Props>>
} {
  const _lengthFn = is.fun(lengthFn) ? lengthFn : () => lengthFn
  const propsFn = is.fun(props) ? props : undefined
  const ref = SpringRef()

  interface State {
    // The controllers used for applying updates.
    ctrls: Controller[]
    // The queue of changes to make on commit.
    queue: Array<() => void>
    // The flush function used by controllers.
    flush: ControllerFlushFn
  }
  let layoutId = 0

  const state: State = {
    ctrls: [],
    queue: [],
    flush(ctrl, updates) {
      const springs = getSprings(ctrl, updates)

      // Flushing is postponed until the component's commit phase
      // if a spring was created since the last commit.
      const canFlushSync =
        layoutId > 0 &&
        !state.queue.length &&
        !Object.keys(springs).some((key) => !ctrl.springs[key])

      return canFlushSync
        ? flushUpdateQueue(ctrl, updates)
        : new Promise<any>((resolve) => {
            setSprings(ctrl, springs)
            state.queue.push(() => {
              resolve(flushUpdateQueue(ctrl, updates))
            })
            // forceUpdate()
          })
    },
  }

  const ctrls = [...state.ctrls]

  const updates: any[] = []
  // Create new controllers when "length" increases, and destroy
  // the affected controllers when "length" decreases.
  createEffect(() => {
    const length = _lengthFn()
    // Clean up any unused controllers
    each(ctrls.slice(length, prevLength), (ctrl) => {
      detachRefs(ctrl, ref)
      ctrl.stop(true)
    })
    ctrls.length = length

    declareUpdates(prevLength, length)
  })

  // Cache old controllers to dispose in the commit phase.
  const prevLength = _lengthFn() || 0
  const [update, setUpdate] = createSignal(Symbol())

  // Update existing controllers when "deps" are changed.
  createRenderEffect(() => {
    const length = _lengthFn()
    declareUpdates(0, Math.min(prevLength, length))
  })

  /** Fill the `updates` array with declarative updates for the given index range. */
  function declareUpdates(startIndex: number, endIndex: number) {
    for (let i = startIndex; i < endIndex; i++) {
      const ctrl = ctrls[i] || (ctrls[i] = new Controller(null, state.flush))

      const update: CreateSpringsProps<any> = propsFn
        ? propsFn(i, ctrl)
        : (props as any)[i]

      if (update) {
        updates[i] = declareUpdate(update)
      }
    }
    setUpdate(Symbol())
  }

  // New springs are created during render so users can pass them to
  // their animated components, but new springs aren't cached until the
  // commit phase (see the `useLayoutEffect` callback below).
  const springs = ctrls.map((ctrl, i) => getSprings(ctrl, updates[i]))

  createRenderEffect(() => {
    update()

    layoutId++

    // Replace the cached controllers.
    state.ctrls = ctrls

    // Flush the commit queue.
    const { queue } = state
    if (queue.length) {
      state.queue = []
      each(queue, (cb) => cb())
    }

    // Update existing controllers.
    each(ctrls, (ctrl, i) => {
      // Attach the controller to the local ref.
      ref.add(ctrl)

      // Update the default props.
      /* if (hasContext) {
        ctrl.start({ default: context })
      } */

      // Apply updates created during render.
      const update = updates[i]
      if (update) {
        // Update the injected ref if needed.
        replaceRef(ctrl, update.ref)

        // When an injected ref exists, the update is postponed
        // until the ref has its `start` method called.
        if (ctrl.ref) {
          ctrl.queue.push(update)
        } else {
          ctrl.start(update)
        }
      }
    })
  })

  onCleanup(() => {
    each(state.ctrls, (ctrl) => ctrl.stop(true))
  })

  const value: Accessor<SpringValues<PickAnimated<Props>>[]> & {
    ref: SpringRefType<PickAnimated<Props>>
  } = createMemo(() => springs.map((x) => ({ ...x }))) as any

  value.ref = ref as any

  return value
}
