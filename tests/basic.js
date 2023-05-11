import test from 'tape'
import { Node, Term, OpNode, distribute } from '../index.js'
import { OP_UNION, OP_INTERSECT, TERM } from '../node-types.js'

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
  })
})
