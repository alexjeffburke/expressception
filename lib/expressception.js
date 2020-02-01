const UnexpectedExpressMocker = require("unexpected-express/lib/UnexpectedExpressMocker");

const Superagent = require("./Superagent");
const Supertest = require("./Supertest");

module.exports = function expressception(subject) {
  const mocker = new UnexpectedExpressMocker(subject);

  return {
    superagent: () => new Superagent(value => mocker.mock(value)),
    supertest: () => new Supertest(value => mocker.mock(value))
  };
};
