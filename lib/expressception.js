const UnexpectedExpressMocker = require("unexpected-express/lib/UnexpectedExpressMocker");

const Superagent = require("./Superagent");
const Supertest = require("./Supertest");

module.exports = function expressception(subject) {
  const mocker = new UnexpectedExpressMocker(subject);

  return {
    superagent: options => new Superagent(options, value => mocker.mock(value)),
    supertest: options => new Supertest(options, value => mocker.mock(value))
  };
};
