import './commands';

// The section editor has a known intermittent dnd-kit crash ("Invalid instance
// type"). It must NOT be swallowed globally — regression spec 04 asserts on it
// deliberately. Anything else uncaught should still fail the test, which is
// Cypress's default, so there is no exception handler here on purpose.
