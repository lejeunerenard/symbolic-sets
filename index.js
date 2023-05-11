import { OP_UNION, OP_INTERSECT, UNIVERSAL, NULL, TERM, OP_COMPLEMENT } from './node-types.js'

export function distribute (node) {
  if (node.type !== OP_UNION && node.type !== OP_INTERSECT) {
    return node
  }

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
    left = new OpNode(originalType, accumulatorChildren)
  }

  // different
  return differentTypeChildren.reduce((accum, right) => {
    const distributedChildren = right.children.map((node) => {
      const result = new OpNode(originalType, [accum, node])
      return accum.type === newOp ? distribute(result) : result
    })

    return new OpNode(newOp, distributedChildren)
  }, left)
}

export class Node {
  constructor (type, children = []) {
    this.type = type
    this.children = children
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
    return new Universal()
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
    return new Null()
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
    return new Term(this.term)
  }

  // CNF is Conjunctive Normalized Form
  toCNF () {
    return new Term(this.term)
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
          new OpNode(OP_COMPLEMENT, [child]).simplify())
        const oppositeOp = child.type === OP_UNION ? OP_INTERSECT : OP_UNION
        return new OpNode(oppositeOp, grandChildren)
      }

      // Involution Law
      if (child.type === OP_COMPLEMENT) return child.children[0]

      return new OpNode(this.type, simpleChildren)
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
      if (node.type === TERM) {
        if (node.term in uniq) return []
        uniq[node.term] = true
      }
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
    if (foundComplementPair) return this.type === OP_UNION ? new Universal() : new Null()

    // Return child if only child. AKA you cant have a UNION nor INTERSECT of just one set
    if (uniqChildren.length === 1) return uniqChildren[0]

    return new OpNode(this.type, uniqChildren)
  }

  toCNF () {
    const simple = this.simplify()
    const cnfChildren = simple.children.map((node) => node.toCNF())

    // Distributive Law
    if (simple.type === OP_UNION && cnfChildren.some((node) => node.type === OP_INTERSECT)) {
      return distribute(new OpNode(simple.type, cnfChildren)).simplify()
    }

    return new OpNode(simple.type, cnfChildren)
  }

  toString () {
    if (this.type === OP_COMPLEMENT) return this.children[0].toString() + '\''
    return '(' + this.children.map((c) => c.toString()).join(this.type === OP_UNION ? ' ∪ ' : ' ∩ ') + ')'
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
