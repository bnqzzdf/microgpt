// Character-level tokenizer for microgpt
// Maps characters to integer token IDs and back

class Tokenizer {
  constructor(chars) {
    this.uchars = chars;           // sorted unique chars e.g. ['a','b',...,'z']
    this.BOS = chars.length;       // Beginning of Sequence token ID
    this.vocabSize = chars.length + 1;

    this._charToId = {};
    for (let i = 0; i < chars.length; i++) {
      this._charToId[chars[i]] = i;
    }

    this._idToChar = {};
    for (let i = 0; i < chars.length; i++) {
      this._idToChar[i] = chars[i];
    }
    this._idToChar[this.BOS] = '<BOS>';
  }

  encode(doc) {
    const tokens = [this.BOS];
    for (const ch of doc) {
      tokens.push(this._charToId[ch]);
    }
    tokens.push(this.BOS);
    return tokens;
  }

  decode(tokens, showBOS = false) {
    return tokens
      .map(t => {
        if (t === this.BOS) return showBOS ? '<BOS>' : '';
        return this._idToChar[t];
      })
      .join('');
  }

  tokenToDisplay(tokenId) {
    if (tokenId === this.BOS) return '<BOS>';
    return this._idToChar[tokenId];
  }
}
