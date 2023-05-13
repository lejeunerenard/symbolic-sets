import { OP_UNION, OP_INTERSECT, UNIVERSAL, NULL, TERM, OP_COMPLEMENT } from './node-types.js'

export function distribute (node) {
  if (node.type !== OP_UNION && node.type !== OP_INTERSECT) {
    return node
  }
  const factory = node.nodeFactory

  const originalType = node.type
  const newOp = originalType === OP_UNION ? OP_INTERSECT : OP_UNION

  const accumulatorChildren = []
  const differentTypeChildren = []
  for (const child of node.children) {
    if (child.type === newOp) {
      differentTypeChildren.push(child)
    } else {
      accumulatorChildren.push(child)
    }
  }

  if (differentTypeChildren.length === 0) return node

  let left
  if (accumulatorChildren.length === 0) {
    left = differentTypeChildren.shift()
  } else if (accumulatorChildren.length === 1) {
    left = accumulatorChildren[0]
  } else {
    left = new factory.OP(originalType, accumulatorChildren)
  }

  // Fold all children w/ different op type into the accumulator
  return differentTypeChildren.reduce((accum, right) => {
    const distributedChildren = right.children.map((node) => {
      const result = new factory.OP(originalType, [accum, node])
      return accum.type === newOp ? distribute(result) : result
    })

    return new factory.OP(newOp, distributedChildren).simplify()
  }, left).simplify()
}

export class Node {
  constructor (type, children = []) {
    this.type = type
    this.children = children

    this.nodeFactory = {
      OP: OpNode,
      UNIVERSAL: Universal,
      NULL: Null,
      TERM: Term
    }
  }

  simplify () {
    throw Error('simplify() not implemented')
  }
}

export class Universal extends Node {
  constructor () {
    super(UNIVERSAL)
  }

  simplify () {
    return new this.constructor()
  }

  toString () {
    return '𝕌'
  }
}

export class Null extends Node {
  constructor () {
    super(NULL)
  }

  simplify () {
    return new this.constructor()
  }

  toString () {
    return '∅'
  }
}

export class Term extends Node {
  constructor (term) {
    super(TERM)
    this.term = term
  }

  simplify () {
    return new this.constructor(this.term)
  }

  // CNF is Conjunctive Normalized Form
  toCNF () {
    return new this.constructor(this.term)
  }

  toString () {
    return this.term
  }
}

export class OpNode extends Node {
  constructor (type, children) {
    super(type, children)

    if (type !== OP_UNION && type !== OP_INTERSECT && type !== OP_COMPLEMENT) {
      throw Error('Only "UNION", "INTERSECT" & "COMPLEMENT" operators are supported')
    }

    if ((children.length < 2 && type !== OP_COMPLEMENT) || (children.length !== 1 && type === OP_COMPLEMENT)) {
      console.error('type', type, 'children', children)
      throw Error(`Operator must have ${type === OP_COMPLEMENT ? 'one child' : 'at least two children'}`)
    }
  }

  simplify () {
    const simpleChildren = this.children.map((node) => node.simplify())
    // Complement specific shortcuts
    if (this.type === OP_COMPLEMENT) {
      const child = simpleChildren[0]
      // DeMorgan's Law
      if (child.type === OP_UNION || child.type === OP_INTERSECT) {
        const grandChildren = child.children.map((child) =>
          new this.nodeFactory.OP(OP_COMPLEMENT, [child]).simplify())
        const oppositeOp = child.type === OP_UNION ? OP_INTERSECT : OP_UNION
        return new this.nodeFactory.OP(oppositeOp, grandChildren)
      }

      // Involution Law
      if (child.type === OP_COMPLEMENT) return child.children[0]

      return new this.nodeFactory.OP(this.type, simpleChildren)
    }

    // Flatten
    const flattenedChildren = simpleChildren.flatMap((child) =>
      child.type === this.type ? child.children : child)

    // Identity laws : Filter absolute set types
    const filteredChildren = flattenedChildren.filter((x) => {
      switch (this.type) {
        case OP_UNION:
          return x.type !== NULL
        case OP_INTERSECT:
          return x.type !== UNIVERSAL
        default:
          return true
      }
    })

    // Null Laws : Account for Greedy absolute sets
    const foundGreedy = filteredChildren.find((x) => {
      switch (this.type) {
        case OP_UNION:
          return x.type === UNIVERSAL
        case OP_INTERSECT:
          return x.type === NULL
        default:
          return false
      }
    })
    const childrenAccountForGreedy = foundGreedy
      ? [foundGreedy]
      : filteredChildren

    // Idempotent Laws via uniqueness
    const uniq = {}
    const uniqChildren = childrenAccountForGreedy.flatMap((node) => {
      const stringRepresentation = node.toString({ sort: true })
      if (stringRepresentation in uniq) return []
      uniq[stringRepresentation] = true
      return node
    })

    // Complement Law
    const shallowTermRefs = {}
    const foundComplementPair = uniqChildren.some((node) => {
      const oppositeOp = node.type === TERM ? OP_COMPLEMENT : TERM
      if (node.type === TERM) {
        if (node.term in shallowTermRefs && shallowTermRefs[node.term].type === oppositeOp) return true
        shallowTermRefs[node.term] = node
      } else if (node.type === OP_COMPLEMENT && node.children[0].type === TERM) {
        const term = node.children[0].term
        if (term in shallowTermRefs && shallowTermRefs[term].type === oppositeOp) return true
        shallowTermRefs[term] = node
      }

      return false
    })
    if (foundComplementPair) return this.type === OP_UNION ? new this.nodeFactory.UNIVERSAL() : new this.nodeFactory.NULL()

    // Absorption Law
    // Get "single" terms & composite terms
    const [singleTerms, compositeTerms] = uniqChildren.reduce((accum, child) => {
      if (child.type === TERM || child.type === OP_COMPLEMENT) {
        accum[0].push(child)
      } else {
        accum[1].push(child)
      }

      return accum
    }, [[], []])
    // Check all composite terms to filter out any that contain the same child term as a single term
    const nonAbsorbedCompositeTerms = compositeTerms.filter((compositeTerm) =>
      !compositeTerm.children.some((grandChild) => {
        return singleTerms.some((term) => {
          return term.type === grandChild.type &&
            (
              (term.type === TERM && term.term === grandChild.term) ||
              (term.type === OP_COMPLEMENT && term.children[0].term === grandChild.children[0].term)
            )
        })
      }))
    const absorbedChildren = singleTerms.concat(nonAbsorbedCompositeTerms)

    // Return child if only child. AKA you cant have a UNION nor INTERSECT of just one set
    if (absorbedChildren.length === 1) return absorbedChildren[0]

    // If completely cleared return universal
    if (absorbedChildren.length === 0) return new this.nodeFactory.UNIVERSAL()

    return new this.nodeFactory.OP(this.type, absorbedChildren)
  }

  toCNF () {
    const cnfChildren = this.children.map((node) => node.toCNF())

    // Distributive Law
    if (this.type === OP_UNION && cnfChildren.some((node) => node.type === OP_INTERSECT)) {
      const distributed = distribute(new this.nodeFactory.OP(this.type, cnfChildren))
      return distributed.simplify()
    }

    return new this.nodeFactory.OP(this.type, cnfChildren).simplify()
  }

  toString ({ sort = false } = {}) {
    if (this.type === OP_COMPLEMENT) return this.children[0].toString() + '\''

    const sortedChildren = sort
      ? [...this.children].sort((a, b) => a.toString().localeCompare(b.toString()))
      : this.children

    return '(' + sortedChildren.map((c) => c.toString()).join(this.type === OP_UNION ? ' ∪ ' : ' ∩ ') + ')'
  }
}

export class UnionNode extends OpNode {
  constructor (children) {
    super(OP_UNION, children)
  }
}

export class IntersectNode extends OpNode {
  constructor (children) {
    super(OP_INTERSECT, children)
  }
}

export class ComplementNode extends OpNode {
  constructor (child) {
    super(OP_COMPLEMENT, [child])
  }
}
