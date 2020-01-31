const UnexpectedExpressMocker = require("unexpected-express/lib/UnexpectedExpressMocker");

const Superagent = require("./Superagent");

module.exports = function expressception(subject) {
  return {
    superagent: () => {
      return new Superagent(value => {
        return new UnexpectedExpressMocker(value).mock(subject);
      });
    }
  };
};
