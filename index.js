import { OP_UNION, OP_INTERSECT, TERM } from './node-types.js'

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
}

export class OpNode extends Node {
  constructor (type, children) {
    super(type, children)

    if (type !== OP_UNION && type !== OP_INTERSECT) {
      throw Error('Only "UNION" & "INTERSECT" operators are supported')
    }

    if (children.length < 2) {
      console.error('type', type, 'children', children)
      throw Error('Operators must have at least two children')
    }
  }

  simplify () {
    const simpleChildren = this.children.map((node) => node.simplify())

    // Flatten
    const flattenedChildren = simpleChildren.flatMap((child) =>
      child.type === this.type ? child.children : child)

    // Idempotent Laws via uniqueness
    const uniq = {}
    const uniqChildren = flattenedChildren.flatMap((node) => {
      if (node.type === TERM) {
        if (node.term in uniq) return []
        uniq[node.term] = true
      }
      return node
    })
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
