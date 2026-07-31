// Adam optimizer — mirrors Karpathy's implementation

class Adam {
  constructor(params, lr = 0.01, beta1 = 0.85, beta2 = 0.99, eps = 1e-8) {
    this.params = params;
    this.lr = lr;
    this.beta1 = beta1;
    this.beta2 = beta2;
    this.eps = eps;
    this.m = params.map(() => 0);
    this.v = params.map(() => 0);
    this.t = 0;
  }

  step(lrScale = 1) {
    this.t++;
    for (let i = 0; i < this.params.length; i++) {
      const p = this.params[i];
      this.m[i] = this.beta1 * this.m[i] + (1 - this.beta1) * p.grad;
      this.v[i] = this.beta2 * this.v[i] + (1 - this.beta2) * p.grad * p.grad;
      const mHat = this.m[i] / (1 - Math.pow(this.beta1, this.t));
      const vHat = this.v[i] / (1 - Math.pow(this.beta2, this.t));
      p.data -= lrScale * this.lr * mHat / (Math.sqrt(vHat) + this.eps);
    }
  }

  zeroGrad() {
    for (const p of this.params) p.grad = 0;
  }
}
