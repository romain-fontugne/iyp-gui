const _ = require('lodash');

function AS(_node) {
  _.extend(this, _node.properties);

  if (this.id) {
    this.id = this.id.toNumber();
  }
  if (this.asn) {
    this.asn = this.asn.toNumber();
  }
}

module.exports = AS;
