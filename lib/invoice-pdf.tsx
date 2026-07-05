import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { GstTreatment } from '@prisma/client';

// Standard PDF fonts (Helvetica) lack the ₹ glyph, so invoices use a safe
// "Rs." format with exact 2-decimal precision.
function money(paise: number): string {
  const [whole, dec] = (paise / 100).toFixed(2).split('.');
  return `Rs. ${Number(whole).toLocaleString('en-IN')}.${dec}`;
}

// Seller (your company). TODO: replace the street line with the full address.
const SELLER = {
  name: 'GTANALYZE SOLUTIONS PRIVATE LIMITED',
  gstin: '33AALCG6598F1Z7',
  addressLines: ['Chennai, Tamil Nadu 600001', 'India'],
  email: 'Request@gotoanalyze.com',
};

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: Date;
  gstTreatment: GstTreatment;
  placeOfSupplyState: string | null;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  buyer: {
    name: string | null;
    email: string;
    state: string | null;
    gstin: string | null;
  };
  lineItemName: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1e293b' },
  brand: { fontSize: 20, fontWeight: 'bold', color: '#4f46e5' },
  h: { fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: '#64748b' },
  block: { marginTop: 16 },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#cbd5e1',
    paddingBottom: 4,
    marginTop: 18,
    fontWeight: 'bold',
  },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.5, borderColor: '#e2e8f0' },
  cDesc: { width: '55%' },
  cAmt: { width: '45%', textAlign: 'right' },
  totals: { marginTop: 12, marginLeft: 'auto', width: '50%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, marginTop: 4, borderTopWidth: 1, borderColor: '#cbd5e1', fontWeight: 'bold', fontSize: 12 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
});

function InvoiceDocument({ data }: { data: InvoiceData }) {
  const isIntra = data.gstTreatment === 'cgst_sgst';
  const isExport = data.gstTreatment === 'export';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.row}>
          <View>
            <Text style={styles.brand}>RioPoly</Text>
            <Text style={styles.muted}>by {SELLER.name}</Text>
            {SELLER.addressLines.map((l) => (
              <Text key={l} style={styles.muted}>{l}</Text>
            ))}
            <Text style={styles.muted}>GSTIN: {SELLER.gstin}</Text>
            <Text style={styles.muted}>{SELLER.email}</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={styles.h}>TAX INVOICE</Text>
            <Text>{data.invoiceNumber}</Text>
            <Text style={styles.muted}>
              {data.issuedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.h}>Bill To</Text>
          <Text>{data.buyer.name ?? data.buyer.email}</Text>
          <Text style={styles.muted}>{data.buyer.email}</Text>
          {data.buyer.gstin ? <Text style={styles.muted}>GSTIN: {data.buyer.gstin}</Text> : null}
          <Text style={styles.muted}>
            Place of supply: {data.placeOfSupplyState ?? (isExport ? 'Outside India (Export)' : '-')}
          </Text>
        </View>

        <View style={styles.tableHead}>
          <Text style={styles.cDesc}>Description</Text>
          <Text style={styles.cAmt}>Amount</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.cDesc}>{data.lineItemName}</Text>
          <Text style={styles.cAmt}>{money(data.taxablePaise)}</Text>
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Taxable value</Text>
            <Text>{money(data.taxablePaise)}</Text>
          </View>
          {isExport ? (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>GST (export, zero-rated)</Text>
              <Text>{money(0)}</Text>
            </View>
          ) : isIntra ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.muted}>CGST @ 9%</Text>
                <Text>{money(data.cgstPaise)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.muted}>SGST @ 9%</Text>
                <Text>{money(data.sgstPaise)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>IGST @ 18%</Text>
              <Text>{money(data.igstPaise)}</Text>
            </View>
          )}
          <View style={styles.grand}>
            <Text>Total</Text>
            <Text>{money(data.totalPaise)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This is a computer-generated invoice. {SELLER.name} · GSTIN {SELLER.gstin}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}
