"""Exact internal cent totals without repeated rational normalization.

Denominators are shared by daily accruals. Integer arithmetic updates totals;
canonical Fraction conversion is needed only for checkpoints and exact output.
This is deliberately not numbers.Rational: its numerator may be unreduced.
"""
from dataclasses import dataclass
from fractions import Fraction
from functools import cached_property
from math import gcd

@dataclass(frozen=True, eq=False)
class ExactCents:
    numerator: int = 0
    denominator: int = 1

    def __post_init__(self):
        if type(self.numerator) is not int or type(self.denominator) is not int or self.denominator <= 0:
            raise ValueError("exact cents require an integer numerator and positive integer denominator")

    @classmethod
    def of(cls, value):
        if isinstance(value, cls): return value
        value = Fraction(value)
        return cls(value.numerator, value.denominator)
    @cached_property
    def fraction(self): return Fraction(self.numerator, self.denominator)
    def as_fraction(self): return self.fraction
    def __hash__(self): return hash(self.fraction)
    def __bool__(self): return bool(self.numerator)
    def __int__(self):
        return self.numerator // self.denominator if self.numerator >= 0 else -((-self.numerator) // self.denominator)
    def _parts(self, other):
        if type(other) is int: return other, 1
        if isinstance(other, (ExactCents, Fraction)): return other.numerator, other.denominator
        return None
    def _combine(self, other, sign):
        parts=self._parts(other)
        if parts is None:return NotImplemented
        n,d=parts
        if d==self.denominator:return ExactCents(self.numerator+sign*n,d)
        if d==1:return ExactCents(self.numerator+sign*n*self.denominator,self.denominator)
        if self.denominator==1:return ExactCents(self.numerator*d+sign*n,d)
        common=gcd(self.denominator,d)
        a,b=d//common,self.denominator//common
        return ExactCents(self.numerator*a+sign*n*b,self.denominator*a)
    def __add__(self, other):return self._combine(other,1)
    def __radd__(self, other):return self+other
    def __sub__(self, other):return self._combine(other,-1)
    def __rsub__(self, other):return (-self)._combine(other,1)
    def __neg__(self):return ExactCents(-self.numerator,self.denominator)
    def __mul__(self, other):
        parts=self._parts(other)
        if parts is None:return NotImplemented
        n,d=parts
        return ExactCents(self.numerator*n,self.denominator*d)
    def __rmul__(self, other):return self*other
    def _compare(self, other):
        parts=self._parts(other)
        if parts is None:return NotImplemented
        n,d=parts
        if self.denominator==d:return self.numerator-n
        return self.numerator*d-n*self.denominator
    def __eq__(self, other):
        value=self._compare(other)
        return NotImplemented if value is NotImplemented else value==0
    def __lt__(self, other):
        value=self._compare(other)
        return NotImplemented if value is NotImplemented else value<0
    def __le__(self, other):
        value=self._compare(other)
        return NotImplemented if value is NotImplemented else value<=0
    def __gt__(self, other):
        value=self._compare(other)
        return NotImplemented if value is NotImplemented else value>0
    def __ge__(self, other):
        value=self._compare(other)
        return NotImplemented if value is NotImplemented else value>=0
