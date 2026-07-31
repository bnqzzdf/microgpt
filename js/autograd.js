// Autograd engine — scalar-level automatic differentiation
// Mirrors Karpathy's micrograd Value class

class Value {
  constructor(data, children = [], localGrads = []) {
    this.data = data;
    this.grad = 0;
    this._children = children;
    this._localGrads = localGrads;
  }

  add(other) {
    if (!(other instanceof Value)) other = new Value(other);
    return new Value(this.data + other.data, [this, other], [1, 1]);
  }

  mul(other) {
    if (!(other instanceof Value)) other = new Value(other);
    return new Value(this.data * other.data, [this, other], [other.data, this.data]);
  }

  pow(n) {
    return new Value(this.data ** n, [this], [n * this.data ** (n - 1)]);
  }

  log() {
    return new Value(Math.log(this.data), [this], [1 / this.data]);
  }

  exp() {
    const e = Math.exp(this.data);
    return new Value(e, [this], [e]);
  }

  relu() {
    return new Value(Math.max(0, this.data), [this], [this.data > 0 ? 1 : 0]);
  }

  neg() {
    return this.mul(-1);
  }

  sub(other) {
    if (!(other instanceof Value)) other = new Value(other);
    return this.add(other.neg());
  }

  div(other) {
    if (!(other instanceof Value)) other = new Value(other);
    return this.mul(other.pow(-1));
  }

  backward() {
    const topo = [];
    const visited = new Set();

    const buildTopo = (v) => {
      if (!visited.has(v)) {
        visited.add(v);
        for (const child of v._children) {
          buildTopo(child);
        }
        topo.push(v);
      }
    };

    buildTopo(this);
    this.grad = 1;

    for (let i = topo.length - 1; i >= 0; i--) {
      const v = topo[i];
      for (let j = 0; j < v._children.length; j++) {
        v._children[j].grad += v._localGrads[j] * v.grad;
      }
    }
  }
}
