# Symbolic Sets

A library for symbolic manipulation of sets and their operators as a tree.

## Usage

```js
import { UnionNode, IntersectNode, Term } from '@lejeunerenard/symbolic-sets'

// Construct a tree for (A ∩ B) ∪ (C ∩ D)
const expression = new UnionNode([
  new IntersectNode([
    new Term('A'),
    new Term('B')
  ]),
  new IntersectNode([
    new Term('C'),
    new Term('D')
  ])
])

// Compute the Conjunctive Normal Form tree
const cnf = expression.toCNF()

// Logs "((C ∪ A) ∩ (C ∪ B) ∩ (D ∪ A) ∩ (D ∪ B))"
console.log(cnf.toString())
```

## Install

```sh
npm install lejeunerenard/symbolic-sets
```

## API

### `new Universal()`

A node that represents the "Universal" set, eg the set that contains all
elements.

### `new Null()`

A node that represents the "Null" set, eg the set that contains nothing.

### `new Term(string)`

A node that represents a simple set denoted by the `string`.

#### `.simplify()`

Returns a new `Term` copy as a term is already simplified.

### `new OpNode(type, children)`

A node that represents a operator node of type `type` operating on `children`
nodes. Current supported operator types are `OP_UNION`, `OP_INTERSECT` &
`OP_COMPLEMENT`.

Note that `OP_UNION` & `OP_INTERSECT` types require 2 or more `children`.
`OP_COMPLEMENT` requires exactly 1 `children`.

#### `.simplify()`

Recursively reduces the node and its `children` into a simplified form with less
nodes.

#### `.toCNF()`

Recursively reduces the node into its [Conjunctive Normal
Form](https://en.wikipedia.org/wiki/Conjunctive_normal_form) aka a intersection
of unions.

### `new UnionNode(children)`

A shortcut for `new OpNode(OP_UNION, children)`.

### `new IntersectNode(children)`

A shortcut for `new OpNode(OP_INTERSECT, children)`.

### `new ComplementNode(child)`

A shortcut for `new OpNode(OP_COMPLEMENT, [child])`.
