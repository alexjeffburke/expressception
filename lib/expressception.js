const UnexpectedExpressMocker = require("unexpected-express/lib/UnexpectedExpressMocker");

const Superagent = require("./Superagent");

module.exports = function expressception(subject) {
  const mocker = new UnexpectedExpressMocker(subject);

  return {
    superagent: () => new Superagent(value => mocker.mock(value))
  };
};
