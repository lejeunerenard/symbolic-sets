import test from 'tape'
import { Node, Term, OpNode, distribute, Universal, Null } from '../index.js'
import { OP_UNION, OP_INTERSECT, TERM, OP_COMPLEMENT } from '../node-types.js'

test('distribute', (t) => {
  t.test('simple', (t) => {
    const start = new OpNode(OP_UNION, [
      new Term('a'),
      new OpNode(OP_INTERSECT, [
        new Term('b'),
        new Term('c')
      ])
    ])

    t.deepEquals(distribute(start), new OpNode(OP_INTERSECT, [
      new OpNode(OP_UNION, [
        new Term('a'),
        new Term('b')
      ]),
      new OpNode(OP_UNION, [
        new Term('a'),
        new Term('c')
      ])
    ]))
    t.end()
  })
})
test('Node', (t) => {
  t.test('constructor', (t) => {
    const child = new Node(OP_UNION)
    const node = new Node(OP_INTERSECT, [child])

    t.is(node.type, OP_INTERSECT, 'sets type')
    t.deepEquals(node.children, [child], 'sets children')
    t.end()
  })
})

test('Term', (t) => {
  t.test('constructor', (t) => {
    const node = new Term('beep')

    t.is(node.type, TERM, 'sets type')
    t.is(node.term, 'beep', 'sets term')
    t.deepEquals(node.children, [], 'sets children')
    t.end()
  })
})

test('OpNode', (t) => {
  t.test('constructor', (t) => {
    const node = new OpNode(OP_UNION, [
      new Term('beep'),
      new Term('boop')
    ])

    t.is(node.type, OP_UNION, 'sets type')
    t.end()
  })

  t.test('UNION', (t) => {
    t.test('toCNF', (t) => {
      t.test('naive', (t) => {
        const node = new OpNode(OP_UNION, [
          new Term('beep'),
          new Term('boop')
        ])

        const cnfNode = node.toCNF()

        t.is(cnfNode.type, OP_UNION, 'new node is OR')
        t.deepEquals(cnfNode.children, node.children, 'new node is the same')
        t.end()
      })

      t.test('distributive law', (t) => {
        const node = new OpNode(OP_UNION, [
          new Term('a'),
          new OpNode(OP_INTERSECT, [
            new Term('b'),
            new Term('c')
          ])
        ])

        const cnfNode = node.toCNF()

        const expected = new OpNode(OP_INTERSECT, [
          new OpNode(OP_UNION, [
            new Term('a'),
            new Term('b')
          ]),
          new OpNode(OP_UNION, [
            new Term('a'),
            new Term('c')
          ])
        ])

        t.is(cnfNode.type, OP_INTERSECT, 'top node is AND')
        t.deepEquals(cnfNode, expected, 'an AND of ORs')

        const multiAnd = new OpNode(OP_UNION, [
          new Term('a'),
          new OpNode(OP_INTERSECT, [
            new Term('b'),
            new Term('c')
          ]),
          new OpNode(OP_INTERSECT, [
            new Term('d'),
            new Term('e')
          ])
        ])

        const multiAndCnfNode = multiAnd.toCNF()

        const multiAndExpected = new OpNode(OP_INTERSECT, [
          new OpNode(OP_UNION, [
            new Term('d'),
            new Term('a'),
            new Term('b')
          ]),
          new OpNode(OP_UNION, [
            new Term('d'),
            new Term('a'),
            new Term('c')
          ]),
          new OpNode(OP_UNION, [
            new Term('e'),
            new Term('a'),
            new Term('b')
          ]),
          new OpNode(OP_UNION, [
            new Term('e'),
            new Term('a'),
            new Term('c')
          ])
        ])

        t.is(multiAndCnfNode.type, OP_INTERSECT, 'top node is still AND')
        t.deepEquals(multiAndCnfNode, multiAndExpected, 'an AND of ANDs of ORs')

        // OR of ANDs
        const orOfAnds = new OpNode(OP_UNION, [
          new OpNode(OP_INTERSECT, [
            new Term('a'),
            new Term('b')
          ]),
          new OpNode(OP_INTERSECT, [
            new Term('c'),
            new Term('d')
          ])
        ])

        t.deepEquals(orOfAnds.toCNF().simplify(), new OpNode(OP_INTERSECT, [
          new OpNode(OP_UNION, [
            new Term('c'),
            new Term('a')
          ]),
          new OpNode(OP_UNION, [
            new Term('c'),
            new Term('b')
          ]),
          new OpNode(OP_UNION, [
            new Term('d'),
            new Term('a')
          ]),
          new OpNode(OP_UNION, [
            new Term('d'),
            new Term('b')
          ])
        ]), 'distributes composite children')
        t.end()
      })
    })
  })

  t.test('INTERSECT', (t) => {
    t.test('toCNF', (t) => {
      t.test('naive', (t) => {
        const node = new OpNode(OP_INTERSECT, [
          new Term('beep'),
          new Term('boop')
        ])

        const cnfNode = node.toCNF()

        t.is(cnfNode.type, OP_INTERSECT, 'new node is AND')
        t.deepEquals(cnfNode.children, node.children, 'new node is the same')
        t.end()
      })
    })
  })

  t.test('simplify', (t) => {
    t.test('noop', (t) => {
      const node = new OpNode(OP_INTERSECT, [
        new Term('beep'),
        new Term('boop')
      ])

      t.deepEquals(node.simplify(), node, 'AND noop')

      const orNode = new OpNode(OP_UNION, [
        new Term('beep'),
        new Term('boop')
      ])

      t.deepEquals(orNode.simplify(), orNode, 'OR noop')
      t.end()
    })

    t.test('flattens same type', (t) => {
      const node = new OpNode(OP_INTERSECT, [
        new Term('a'),
        new OpNode(OP_INTERSECT, [
          new Term('b'),
          new Term('c')
        ])
      ])

      t.deepEquals(node.simplify(), new OpNode(OP_INTERSECT, [
        new Term('a'),
        new Term('b'),
        new Term('c')
      ]), 'AND flattens')

      t.end()
    })

    t.test('removes Universal for INTERSECT', (t) => {
      const node = new OpNode(OP_INTERSECT, [
        new Term('A'),
        new Universal()
      ])

      t.deepEquals(node.simplify(), new Term('A'), 'Reduces A ∩ 𝕌 to A')

      const naryNode = new OpNode(OP_INTERSECT, [
        new Term('A'),
        new Universal(),
        new Term('B')
      ])

      t.deepEquals(naryNode.simplify(), new OpNode(OP_INTERSECT, [
        new Term('A'),
        new Term('B')
      ]), 'Reduces A ∩ 𝕌 ∩ B to A ∩ B')

      t.end()
    })

    t.test('removes Null for UNION', (t) => {
      const node = new OpNode(OP_UNION, [
        new Term('A'),
        new Null()
      ])

      t.deepEquals(node.simplify(), new Term('A'), 'Reduces A ∪ ∅ to A')

      const naryNode = new OpNode(OP_UNION, [
        new Term('A'),
        new Null(),
        new Term('B')
      ])

      t.deepEquals(naryNode.simplify(), new OpNode(OP_UNION, [
        new Term('A'),
        new Term('B')
      ]), 'Reduces A ∪ ∅ ∪ B to A ∪ B')

      t.end()
    })

    t.test('union w/ Universal', (t) => {
      const node = new OpNode(OP_UNION, [
        new Term('A'),
        new Universal()
      ])

      t.deepEquals(node.simplify(), new Universal(), 'Reduces A ∪ 𝕌 to 𝕌')

      const naryNode = new OpNode(OP_UNION, [
        new Term('A'),
        new Universal(),
        new Term('B')
      ])

      t.deepEquals(naryNode.simplify(), new Universal(), 'Reduces A ∪ 𝕌 ∪ B to 𝕌')

      t.end()
    })

    t.test('intersect w/ Null', (t) => {
      const node = new OpNode(OP_INTERSECT, [
        new Term('A'),
        new Null()
      ])

      t.deepEquals(node.simplify(), new Null(), 'Reduces A ∪ ∅ to ∅')

      const naryNode = new OpNode(OP_INTERSECT, [
        new Term('A'),
        new Null(),
        new Term('B')
      ])

      t.deepEquals(naryNode.simplify(), new Null(), 'Reduces A ∪ ∅ ∪ B to ∅')

      t.end()
    })

    t.test('De Morgan\'s law', (t) => {
      t.test('of Unions', (t) => {
        const node = new OpNode(OP_COMPLEMENT, [new OpNode(OP_UNION, [
          new Term('A'),
          new Term('B')
        ])])

        t.deepEquals(node.simplify(), new OpNode(OP_INTERSECT, [
          new OpNode(OP_COMPLEMENT, [new Term('A')]),
          new OpNode(OP_COMPLEMENT, [new Term('B')])
        ]), 'Reduces (A ∪ B)\' to A\' ∩ B\'')

        const naryNode = new OpNode(OP_COMPLEMENT, [new OpNode(OP_UNION, [
          new Term('A'),
          new Term('B'),
          new Term('C')
        ])])

        t.deepEquals(naryNode.simplify(), new OpNode(OP_INTERSECT, [
          new OpNode(OP_COMPLEMENT, [new Term('A')]),
          new OpNode(OP_COMPLEMENT, [new Term('B')]),
          new OpNode(OP_COMPLEMENT, [new Term('C')])
        ]), 'Reduces (A ∪ B ∪ C)\' to A\' ∩ B\' ∩ C\'')

        t.end()
      })

      t.test('of Intersections', (t) => {
        const node = new OpNode(OP_COMPLEMENT, [new OpNode(OP_INTERSECT, [
          new Term('A'),
          new Term('B')
        ])])

        t.deepEquals(node.simplify(), new OpNode(OP_UNION, [
          new OpNode(OP_COMPLEMENT, [new Term('A')]),
          new OpNode(OP_COMPLEMENT, [new Term('B')])
        ]), 'Reduces (A ∩ B)\' to A\' ∪ B\'')

        const naryNode = new OpNode(OP_COMPLEMENT, [new OpNode(OP_INTERSECT, [
          new Term('A'),
          new Term('B'),
          new Term('C')
        ])])

        t.deepEquals(naryNode.simplify(), new OpNode(OP_UNION, [
          new OpNode(OP_COMPLEMENT, [new Term('A')]),
          new OpNode(OP_COMPLEMENT, [new Term('B')]),
          new OpNode(OP_COMPLEMENT, [new Term('C')])
        ]), 'Reduces (A ∩ B ∩ C)\' to A\' ∪ B\' ∪ C\'')

        t.end()
      })
    })

    t.test('involution aka complement of complement', (t) => {
      const node = new OpNode(OP_COMPLEMENT, [
        new OpNode(OP_COMPLEMENT, [new Term('A')])
      ])

      t.deepEquals(node.simplify(), new Term('A'), 'Reduces (A\')\' to A')

      t.end()
    })

    t.test('involution across De Morgan', (t) => {
      const node = new OpNode(OP_COMPLEMENT, [
        new OpNode(OP_INTERSECT, [
          new OpNode(OP_COMPLEMENT, [new Term('A')]),
          new OpNode(OP_COMPLEMENT, [new Term('B')])
        ])
      ])

      t.deepEquals(node.simplify(), new OpNode(OP_UNION, [
        new Term('A'),
        new Term('B')
      ]), 'Reduces (A\' ∩ B\')\' to A ∪ B')

      t.end()
    })

    t.test('complement law', (t) => {
      const node = new OpNode(OP_UNION, [
        new OpNode(OP_COMPLEMENT, [new Term('A')]),
        new Term('A')
      ])

      t.deepEquals(node.simplify(), new Universal(), 'Reduces A\' ∪ A to 𝕌')

      const intersectionNode = new OpNode(OP_INTERSECT, [
        new OpNode(OP_COMPLEMENT, [new Term('A')]),
        new Term('A')
      ])

      t.deepEquals(intersectionNode.simplify(), new Null(), 'Reduces A\' ∩ A to ∅')

      t.end()
    })

    // TODO Figure out how to either do this w/o .toCNF() or rearrange tests to
    // group .toCNF() together
    t.test('complement after distribution', (t) => {
      const node = new OpNode(OP_UNION, [
        new OpNode(OP_COMPLEMENT, [new Term('A')]),
        new OpNode(OP_INTERSECT, [
          new Term('A'),
          new Term('B')
        ])
      ])

      const expectedNode = new OpNode(OP_UNION, [
        new OpNode(OP_COMPLEMENT, [new Term('A')]),
        new Term('B')
      ])
      t.deepEquals(node.toCNF(), expectedNode, 'Reduces A\' ∪ (A ∩ B) to A\' ∪ B')

      t.end()
    })
  })
})
