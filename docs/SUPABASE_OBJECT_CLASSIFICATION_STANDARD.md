# Supabase object classification standard

Classify every statement and resulting object independently. A table-level
label never substitutes for column, constraint, index, policy, function, or
trigger labels. Deployed labels remain `UNKNOWN` until catalog evidence is
supplied for the named environment.

## EXACT

The object name and type match, and all relevant behavior matches: columns,
types, defaults, nullability, identity/sequence behavior, constraints, index
definitions, RLS state and policy semantics, and function/trigger behavior.
Formatting and catalog-assigned identifiers are ignored only when they do not
change behavior.

## COMPATIBLE

Representation or non-functional metadata differs, while application behavior
and fresh replay remain equivalent. The difference must be explicit, proven
low risk, and supported by catalog and application evidence.

## INCOMPATIBLE

Any conflicting type, default, nullability, identity behavior, constraint,
foreign-key action, index behavior, RLS/policy semantics, trigger/function
behavior, or application assumption. This requires a deliberate design
decision or corrective migration in a later approved Story.

## ABSENT

The named object or required property does not exist in the inspected
environment. Absence must be proven by the relevant complete catalog result.

## UNKNOWN

Evidence is missing, partial, stale, unlabeled, environment-ambiguous, or
insufficient for an exact comparison. `UNKNOWN` blocks restoration.

## Comparison record

Each record must include environment, source statement and file, schema,
object and property, expected definition, observed evidence reference,
classification, rationale, application impact, security impact, and reviewer.
Never average child classifications: one incompatible or unknown required
property prevents an object from being declared exact.
