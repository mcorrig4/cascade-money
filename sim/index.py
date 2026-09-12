"""Immutable published index with exact short-interval differences."""
from collections.abc import Mapping
from fractions import Fraction
from math import lcm
from types import MappingProxyType
from dataclasses import dataclass
from .events import rational

@dataclass(frozen=True, init=False, eq=False)
class IndexSeries(Mapping):
    _values: object
    _increments: object
    _text: str
    _last: int
    scale: int
    prefixes: object
    def __init__(self, values=None, increments=None):
        object.__setattr__(self, "_values", MappingProxyType(dict(values or {0: Fraction(1)})))
        object.__setattr__(self, "_increments", MappingProxyType(dict(increments or {})))
        object.__setattr__(self, "_last", max(self._values))
        object.__setattr__(self, "_text", rational(self._values[self._last]))
        scale = lcm(*(v.denominator for v in self._values.values()))
        object.__setattr__(self, "scale", scale)
        object.__setattr__(self, "prefixes", MappingProxyType({d:v.numerator*(scale//v.denominator) for d,v in self._values.items()}))
    def __getitem__(self, key): return self._values[key]
    def __iter__(self): return iter(self._values)
    def __len__(self): return len(self._values)
    def values(self): return self._values.values()
    def items(self): return self._values.items()
    def __eq__(self, other):
        return self is other or self._values == (other._values if isinstance(other, IndexSeries) else other)
    def serialized(self, day):
        return self._text if day == self._last else rational(self[day])
    def publish(self, day, value, increment):
        scale = lcm(self.scale, increment.denominator, value.denominator)
        multiplier = scale // self.scale
        prefixes = {d:n*multiplier for d,n in self.prefixes.items()}
        prefixes[day] = value.numerator * (scale // value.denominator)
        result = object.__new__(type(self))
        for name, field in (("_values", MappingProxyType({**self._values, day:value})),
                            ("_increments", MappingProxyType({**self._increments, day:increment})),
                            ("_last", day), ("_text", rational(value)), ("scale", scale),
                            ("prefixes", MappingProxyType(prefixes))):
            object.__setattr__(result, name, field)
        return result
    def interval(self, start, end):
        # Telescoping the published increments is exactly I(E)-I(S-1).
        if end-start < 4 and all(d in self._increments for d in range(start,end+1)):
            return sum((self._increments[d] for d in range(start,end+1)), Fraction(0))
        return self[end]-self[start-1]
