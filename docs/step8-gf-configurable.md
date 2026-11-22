# Configurable Geometry Finder searches

`raw.gfevnt` searches a named geometric quantity against a relation. Each quantity parameter carries its name and optional text, real, integer and logical values. `raw.gffove` searches for intersections with an instrument field of view. `raw.gfocce` searches for occultations. Each uses the corresponding N0067 configurable entry point and accepts a convergence tolerance in seconds.

The control function receives a discriminated event. Return a positive number of seconds for `step`, an epoch within the bracket for `refine`, a boolean for `bail`, and no value for the three progress events. Set `report` to request progress and `bail` to request interruption checks. The progress-start event carries a copy of the window endpoints and the toolkit's prefix and suffix. Synchronous clients require synchronous control functions. In the web worker client a control function may await an independent measurement before responding.

Confinement is copied before the first callback. Normal completion publishes the whole result to the original live output claim. An interrupted search preserves the previous result. Releasing a result handle and allocating another during a callback invalidates the original claim. The shared search guard rejects nested searches before they change N0067's state.

The independent SpiceyPy fixture runs the same callbacks with the locked N0067 library. It records every callback in order and compares both complete windows using the authored audit geometry and instrument kernels. Dedicated interruption cases begin with a pre-existing result interval.
