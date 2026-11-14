from __future__ import annotations

from .. import token_oracle

import spiceypy as sp

from .. import string_oracle
from ..models import (
    StepOutput,
    WorkflowStep,
    StepStringsNextwd,
    StepStringsNthwd,
    StepStringsLparse,
    StepStringsLparsm,
    StepStringsLx4dec,
    StepStringsLx4num,
    StepStringsLx4sgn,
    StepStringsLx4uns,
    StepStringsLxqstr,
    StepStringsCmprss,
    StepStringsEqstr,
    StepStringsIswhsp,
    StepStringsLastnb,
    StepStringsLcase,
    StepStringsUcase,
    StepStringsMatchi,
    StepStringsMatchw,
)


def run_strings_step(step: WorkflowStep) -> StepOutput | None:
    if isinstance(step, StepStringsNextwd):
        return StepOutput(op=step.op, value=token_oracle.next_word(step.input, step.nexlen, step.reslen))

    if isinstance(step, StepStringsNthwd):
        return StepOutput(op=step.op, value=token_oracle.nth_word(step.input, step.nth, step.worlen))

    if isinstance(step, StepStringsLparse):
        return StepOutput(op=step.op, value=token_oracle.parse_items(step.list, step.delim, step.nmax, step.itemln, multiple=False))

    if isinstance(step, StepStringsLparsm):
        return StepOutput(op=step.op, value=token_oracle.parse_items(step.list, step.delims, step.nmax, step.itemln, multiple=True))

    if isinstance(step, StepStringsLx4dec):
        return StepOutput(op=step.op, value=token_oracle.scan("lx4dec", step.input, step.first))

    if isinstance(step, StepStringsLx4num):
        return StepOutput(op=step.op, value=token_oracle.scan("lx4num", step.input, step.first))

    if isinstance(step, StepStringsLx4sgn):
        return StepOutput(op=step.op, value=token_oracle.scan("lx4sgn", step.input, step.first))

    if isinstance(step, StepStringsLx4uns):
        return StepOutput(op=step.op, value=token_oracle.scan("lx4uns", step.input, step.first))

    if isinstance(step, StepStringsLxqstr):
        return StepOutput(op=step.op, value=token_oracle.scan("lxqstr", step.input, step.first, step.qchar))

    if isinstance(step, StepStringsCmprss):
        return StepOutput(op=step.op, value=string_oracle.cmprss(step.delim, step.n, step.input, step.lenout))

    if isinstance(step, StepStringsEqstr):
        string_oracle.validate_text(step.a, step.b)
        return StepOutput(op=step.op, value=sp.eqstr(step.a, step.b))

    if isinstance(step, StepStringsIswhsp):
        string_oracle.validate_text(step.input)
        return StepOutput(op=step.op, value=sp.iswhsp(step.input))

    if isinstance(step, StepStringsLastnb):
        string_oracle.validate_text(step.input)
        return StepOutput(op=step.op, value=sp.lastnb(step.input))

    if isinstance(step, StepStringsLcase):
        return StepOutput(op=step.op, value=string_oracle.lcase(step.input, step.lenout))

    if isinstance(step, StepStringsUcase):
        return StepOutput(op=step.op, value=string_oracle.ucase(step.input, step.lenout))

    if isinstance(step, StepStringsMatchi):
        string_oracle.validate_text(step.input, step.template)
        string_oracle.single_byte(step.wstr)
        string_oracle.single_byte(step.wchr)
        return StepOutput(op=step.op, value=sp.matchi(step.input, step.template, step.wstr, step.wchr))

    if isinstance(step, StepStringsMatchw):
        string_oracle.validate_text(step.input, step.template)
        string_oracle.single_byte(step.wstr)
        string_oracle.single_byte(step.wchr)
        return StepOutput(op=step.op, value=sp.matchw(step.input, step.template, step.wstr, step.wchr))

    return None
