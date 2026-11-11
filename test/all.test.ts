// Single bundling entry so `npm test` compiles every suite with esbuild and
// hands Node's test runner one file.
import './resolve.test';
import './render.test';
import './css-contract.test';
