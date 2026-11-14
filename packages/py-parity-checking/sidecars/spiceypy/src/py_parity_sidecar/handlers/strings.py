from __future__ import annotations

import spiceypy as sp

from .. import numeric_oracle
from .. import string_oracle
from ..models import (
    StepOutput,
    WorkflowStep,
    StepStringsDp2hx,
    StepStringsHx2dp,
    StepStringsPrsdp,
    StepStringsPrsint,
    StepStringsRepmc,
    StepStringsRepmct,
    StepStringsRepmd,
    StepStringsRepmf,
    StepStringsRepmi,
    StepStringsRepml,
    StepStringsRepmot,
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
    if isinstance(step, StepStringsDp2hx):
        return StepOutput(op=step.op,value=numeric_oracle.dp2hx(step.value, step.lenout))

    if isinstance(step, StepStringsHx2dp):
        return StepOutput(op=step.op,value=numeric_oracle.hx2dp(step.input, step.lenout))

    if isinstance(step, StepStringsPrsdp):
        return StepOutput(op=step.op,value=numeric_oracle.prsdp(step.input))

    if isinstance(step, StepStringsPrsint):
        return StepOutput(op=step.op,value=numeric_oracle.prsint(step.input))

    if isinstance(step, StepStringsRepmc):
        return StepOutput(op=step.op,value=numeric_oracle.repmc(step.input, step.marker, step.value, step.lenout))

    if isinstance(step, StepStringsRepmct):
        return StepOutput(op=step.op,value=numeric_oracle.repmct(step.input, step.marker, step.value, step.rtcase, step.lenout))

    if isinstance(step, StepStringsRepmd):
        return StepOutput(op=step.op,value=numeric_oracle.repmd(step.input, step.marker, step.value, step.sigdig, step.lenout))

    if isinstance(step, StepStringsRepmf):
        return StepOutput(op=step.op,value=numeric_oracle.repmf(step.input, step.marker, step.value, step.sigdig, step.format, step.lenout))

    if isinstance(step, StepStringsRepmi):
        return StepOutput(op=step.op,value=numeric_oracle.repmi(step.input, step.marker, step.value, step.lenout))

    if isinstance(step, StepStringsRepml):
        return StepOutput(op=step.op,value=numeric_oracle.repml(step.input, step.marker, step.value, step.rtcase, step.lenout))

    if isinstance(step, StepStringsRepmot):
        return StepOutput(op=step.op,value=numeric_oracle.repmot(step.input, step.marker, step.value, step.rtcase, step.lenout))

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
