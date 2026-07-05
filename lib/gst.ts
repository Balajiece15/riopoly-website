import type { GstTreatment } from '@prisma/client';

// Single GST rate for SaaS (18%). Prices are GST-INCLUSIVE, so we back-compute.
const GST_RATE = 0.18;

/**
 * Place-of-supply rule:
 *  - Tamil Nadu (our state) -> intra-state -> CGST 9% + SGST 9%
 *  - Any other Indian state -> inter-state -> IGST 18%
 *  - Outside India -> export -> 0% GST
 */
export function gstTreatmentFor(
  state?: string | null,
  country?: string | null,
): GstTreatment {
  const c = (country ?? 'IN').toUpperCase();
  if (c !== 'IN') return 'export';
  const s = (state ?? '').trim().toLowerCase();
  return s === 'tamil nadu' ? 'cgst_sgst' : 'igst';
}

export interface GstBreakup {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  treatment: GstTreatment;
}

/** Split a GST-inclusive gross (paise) into taxable + tax components. */
export function computeGstInclusive(grossPaise: number, treatment: GstTreatment): GstBreakup {
  if (treatment === 'export') {
    return {
      taxablePaise: grossPaise,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      totalPaise: grossPaise,
      treatment,
    };
  }

  const taxablePaise = Math.round(grossPaise / (1 + GST_RATE));
  const gst = grossPaise - taxablePaise;

  if (treatment === 'cgst_sgst') {
    const cgstPaise = Math.round(gst / 2);
    const sgstPaise = gst - cgstPaise; // keep the split exact to the paise
    return { taxablePaise, cgstPaise, sgstPaise, igstPaise: 0, totalPaise: grossPaise, treatment };
  }

  // igst
  return { taxablePaise, cgstPaise: 0, sgstPaise: 0, igstPaise: gst, totalPaise: grossPaise, treatment };
}
