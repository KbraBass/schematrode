const fs = require('fs');
const xml2js = require('xml2js');
const currencyjs = require('currency.js');
const { sum } = require('lodash');

const invoice = "<Invoice xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xs=\"http://www.w3.org/2001/XMLSchema\" xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\" xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\" xmlns:cec=\"urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2\" xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\" xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\">\n  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>\n  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>\n  <cbc:ID>2558454</cbc:ID>\n  <cbc:IssueDate>2023-09-22</cbc:IssueDate>\n  <cbc:DueDate>2023-10-22</cbc:DueDate>\n  <cbc:InvoiceTypeCode listID=\"UNCL1001\">380</cbc:InvoiceTypeCode>\n  <cbc:Note>Kundnummer: 10010055</cbc:Note>\n  <cbc:TaxPointDate>2023-09-21</cbc:TaxPointDate>\n  <cbc:DocumentCurrencyCode listID=\"ISO4217\">SEK</cbc:DocumentCurrencyCode>\n  <cbc:AccountingCost>A Hus Juni-Aug 2023</cbc:AccountingCost>\n  <cbc:BuyerReference>Magnus Carlsson Alnarp</cbc:BuyerReference>\n  <cac:AccountingSupplierParty>\n    <cac:Party>\n      <cbc:EndpointID schemeID=\"0007\">2021002817</cbc:EndpointID>\n      <cac:PartyIdentification>\n        <cbc:ID schemeID=\"0007\">2021002817</cbc:ID>\n              </cac:PartyIdentification>\n      <cac:PartyName>\n        <cbc:Name>SLU</cbc:Name>\n              </cac:PartyName>\n      <cac:PostalAddress>\n        <cbc:StreetName>BOX 7086</cbc:StreetName>\n        <cbc:CityName>UPPSALA</cbc:CityName>\n        <cbc:PostalZone>750 07</cbc:PostalZone>\n        <cac:Country>\n          <cbc:IdentificationCode listID=\"ISO3166-1:Alpha2\">SE</cbc:IdentificationCode>\n                  </cac:Country>\n              </cac:PostalAddress>\n      <cac:PartyTaxScheme>\n        <cbc:CompanyID>SE202100281701</cbc:CompanyID>\n        <cac:TaxScheme>\n          <cbc:ID>VAT</cbc:ID>\n                  </cac:TaxScheme>\n              </cac:PartyTaxScheme>\n      <cac:PartyTaxScheme>\n        <cbc:CompanyID>Godkänd för F-skatt</cbc:CompanyID>\n        <cac:TaxScheme>\n          <cbc:ID>TAX</cbc:ID>\n                  </cac:TaxScheme>\n              </cac:PartyTaxScheme>\n      <cac:PartyLegalEntity>\n        <cbc:RegistrationName>SLU</cbc:RegistrationName>\n        <cbc:CompanyID>2021002817</cbc:CompanyID>\n        <cbc:CompanyLegalForm>Uppsala</cbc:CompanyLegalForm>\n              </cac:PartyLegalEntity>\n      <cac:Contact>\n        <cbc:Telephone>018-671000</cbc:Telephone>\n        <cbc:ElectronicMail>Sonja.Trulsson@slu.se</cbc:ElectronicMail>\n              </cac:Contact>\n          </cac:Party>\n      </cac:AccountingSupplierParty>\n  <cac:AccountingCustomerParty>\n    <cac:Party>\n      <cbc:EndpointID schemeID=\"0007\">5564599156</cbc:EndpointID>\n      <cac:PartyIdentification>\n        <cbc:ID schemeID=\"0007\">5564599156</cbc:ID>\n              </cac:PartyIdentification>\n      <cac:PartyName>\n        <cbc:Name>AKADEMISKA HUS  AB</cbc:Name>\n              </cac:PartyName>\n      <cac:PostalAddress>\n        <cbc:StreetName>FE 35</cbc:StreetName>\n        <cbc:CityName>FRÖSÖN</cbc:CityName>\n        <cbc:PostalZone>838 73</cbc:PostalZone>\n        <cac:Country>\n          <cbc:IdentificationCode listID=\"ISO3166-1:Alpha2\">SE</cbc:IdentificationCode>\n                  </cac:Country>\n              </cac:PostalAddress>\n      <cac:PartyLegalEntity>\n        <cbc:RegistrationName>AKADEMISKA HUS  AB</cbc:RegistrationName>\n        <cbc:CompanyID>5564599156</cbc:CompanyID>\n              </cac:PartyLegalEntity>\n      <cac:Contact>\n        <cbc:Name>AKADEMISKA HUS  AB</cbc:Name>\n              </cac:Contact>\n          </cac:Party>\n      </cac:AccountingCustomerParty>\n  <cac:Delivery>\n    <cbc:ActualDeliveryDate>2023-09-21</cbc:ActualDeliveryDate>\n    <cac:DeliveryLocation>\n      <cac:Address>\n        <cbc:StreetName>BOX 50</cbc:StreetName>\n        <cbc:CityName>ALNARP</cbc:CityName>\n        <cbc:PostalZone>230 53</cbc:PostalZone>\n        <cac:Country>\n          <cbc:IdentificationCode listID=\"ISO3166-1:Alpha2\">SE</cbc:IdentificationCode>\n                  </cac:Country>\n              </cac:Address>\n          </cac:DeliveryLocation>\n      </cac:Delivery>\n  <cac:PaymentMeans>\n    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>\n    <cbc:PaymentID>255845497</cbc:PaymentID>\n    <cac:PayeeFinancialAccount>\n      <cbc:ID>50524891</cbc:ID>\n      <cac:FinancialInstitutionBranch>\n        <cbc:ID>SE:BANKGIRO</cbc:ID>\n              </cac:FinancialInstitutionBranch>\n          </cac:PayeeFinancialAccount>\n      </cac:PaymentMeans>\n  <cac:PaymentTerms>\n    <cbc:Note>30 dagar netto</cbc:Note>\n      </cac:PaymentTerms>\n  <cac:TaxTotal>\n    <cbc:TaxAmount currencyID=\"SEK\">538.63</cbc:TaxAmount>\n    <cac:TaxSubtotal>\n      <cbc:TaxableAmount currencyID=\"SEK\">2154.50</cbc:TaxableAmount>\n      <cbc:TaxAmount currencyID=\"SEK\">538.63</cbc:TaxAmount>\n      <cac:TaxCategory>\n        <cbc:ID schemeID=\"UNCL5305\">S</cbc:ID>\n        <cbc:Percent>25</cbc:Percent>\n        <cac:TaxScheme>\n          <cbc:ID>VAT</cbc:ID>\n                  </cac:TaxScheme>\n              </cac:TaxCategory>\n          </cac:TaxSubtotal>\n      </cac:TaxTotal>\n  <cac:LegalMonetaryTotal>\n    <cbc:LineExtensionAmount currencyID=\"SEK\">2154.50</cbc:LineExtensionAmount>\n    <cbc:TaxExclusiveAmount currencyID=\"SEK\">2154.50</cbc:TaxExclusiveAmount>\n    <cbc:TaxInclusiveAmount currencyID=\"SEK\">2693.13</cbc:TaxInclusiveAmount>\n    <cbc:AllowanceTotalAmount currencyID=\"SEK\">0.00</cbc:AllowanceTotalAmount>\n    <cbc:ChargeTotalAmount currencyID=\"SEK\">0.00</cbc:ChargeTotalAmount>\n    <cbc:PayableRoundingAmount currencyID=\"SEK\">-0.13</cbc:PayableRoundingAmount>\n    <cbc:PayableAmount currencyID=\"SEK\">2693.00</cbc:PayableAmount>\n      </cac:LegalMonetaryTotal>\n  <cac:InvoiceLine>\n    <cbc:ID>1</cbc:ID>\n    <cbc:Note>230616\nOrdernummer: 610202053</cbc:Note>\n    <cbc:InvoicedQuantity unitCode=\"HUR\" unitCodeListID=\"UNECERec20\">1</cbc:InvoicedQuantity>\n    <cbc:LineExtensionAmount currencyID=\"SEK\">423.00</cbc:LineExtensionAmount>\n    <cac:Item>\n      <cbc:Name>Sanerat Miljöstation nr 7</cbc:Name>\n      <cac:SellersItemIdentification>\n        <cbc:ID>A3336</cbc:ID>\n              </cac:SellersItemIdentification>\n      <cac:ClassifiedTaxCategory>\n        <cbc:ID schemeID=\"UNCL5305\">S</cbc:ID>\n        <cbc:Percent>25</cbc:Percent>\n        <cac:TaxScheme>\n          <cbc:ID>VAT</cbc:ID>\n                  </cac:TaxScheme>\n              </cac:ClassifiedTaxCategory>\n          </cac:Item>\n    <cac:Price>\n      <cbc:PriceAmount currencyID=\"SEK\">423</cbc:PriceAmount>\n          </cac:Price>\n      </cac:InvoiceLine>\n  <cac:InvoiceLine>\n    <cbc:ID>2</cbc:ID>\n    <cbc:Note>Ordernummer: 610202053</cbc:Note>\n    <cbc:InvoicedQuantity unitCode=\"HUR\" unitCodeListID=\"UNECERec20\">1.5</cbc:InvoicedQuantity>\n    <cbc:LineExtensionAmount currencyID=\"SEK\">634.50</cbc:LineExtensionAmount>\n    <cac:Item>\n      <cbc:Name>Röjt innergård H hus för plattsättning</cbc:Name>\n      <cac:SellersItemIdentification>\n        <cbc:ID>A3336</cbc:ID>\n              </cac:SellersItemIdentification>\n      <cac:ClassifiedTaxCategory>\n        <cbc:ID schemeID=\"UNCL5305\">S</cbc:ID>\n        <cbc:Percent>25</cbc:Percent>\n        <cac:TaxScheme>\n          <cbc:ID>VAT</cbc:ID>\n                  </cac:TaxScheme>\n              </cac:ClassifiedTaxCategory>\n          </cac:Item>\n    <cac:Price>\n      <cbc:PriceAmount currencyID=\"SEK\">423</cbc:PriceAmount>\n          </cac:Price>\n      </cac:InvoiceLine>\n  <cac:InvoiceLine>\n    <cbc:ID>3</cbc:ID>\n    <cbc:Note>Samtliga jobb beställt av Magnus Carlsson\nOrdernummer: 610202053</cbc:Note>\n    <cbc:InvoicedQuantity unitCode=\"EA\" unitCodeListID=\"UNECERec20\">1</cbc:InvoicedQuantity>\n    <cbc:LineExtensionAmount currencyID=\"SEK\">1097.00</cbc:LineExtensionAmount>\n    <cac:Item>\n      <cbc:Name>Gräsfrö , fjärrvärmegräving</cbc:Name>\n      <cac:SellersItemIdentification>\n        <cbc:ID>A3336</cbc:ID>\n              </cac:SellersItemIdentification>\n      <cac:ClassifiedTaxCategory>\n        <cbc:ID schemeID=\"UNCL5305\">S</cbc:ID>\n        <cbc:Percent>25</cbc:Percent>\n        <cac:TaxScheme>\n          <cbc:ID>VAT</cbc:ID>\n                  </cac:TaxScheme>\n              </cac:ClassifiedTaxCategory>\n          </cac:Item>\n    <cac:Price>\n      <cbc:PriceAmount currencyID=\"SEK\">1097</cbc:PriceAmount>\n          </cac:Price>\n      </cac:InvoiceLine>\n  </Invoice>\n";

// Convert from JSON ->> XML
const convertUblJsonToUblXml = async (json) => {
  const builder = new xml2js.Builder();
  return builder.buildObject(json);
};

// Convert from XML (string) ->> JSON
const convertUblXmlToUblJson = async (xmlString, options = { explicitArray: true, explicitCharkey: true }) => {
  const parser = new xml2js.Parser(options);
  return parser.parseStringPromise(xmlString);
};

const stripPeppolAttachments = (message) => {
  let data = message;
  if (data.includes('EmbeddedDocumentBinaryObject ')) {
    // We have one or more attachment(s)
    // We'll strip the attachemnt base64 data and replace with a smaller valid base 64 to allow the size to be smaller

    const base64min = 'dmFsaWQgYmFzZTY0'; // = "valid base64"
    // We create a RegEx with groups of the base64 original and replace all with the minimized base64 for validation
    data = data.replace(
      /(:EmbeddedDocumentBinaryObject[\s\S]*?>)([\s\S]*?)(<\/[\s\S]*?:EmbeddedDocumentBinaryObject>)/g,
      `$1${base64min}$3`
    );
  }
  return data;
};

const getNamespaces = (message) => ({
  cac: message.match(/xmlns:([\S]+)[\s]*=[\s]*"[a-z:]+CommonAggregateComponents/).at(1) || '',
  cbc: message.match(/xmlns:([\S]+)[\s]*=[\s]*"[a-z:]+CommonBasicComponents/).at(1) || ''
});

async function validatePeppolXml(xml, msgType) {
  const response = await fetch(`https://server.com/validate/peppol/bis3/invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'Accept': 'application/json'
    },
    body: xml
  });
  if (!response.ok) {
    throw new Error(`Validation failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

const stripPeppolItems = async (j, msgType, ns) => {
  const sums = {
    subTotal: 0
  };
  const errors = [];

  const len = j[msgType].cac_InvoiceLine.length;
  if (!len) {
    errors.push({
      errorLevel: 'ERROR',
      errorID: 'BR-16',
      errorFieldName: '/:Invoice[1]',
      test: 'exists(cac:InvoiceLine) or exists(cac:CreditNoteLine)',
      errorText: '[BR-16]-An Invoice shall have at least one Invoice line (BG-25)'
    });
  }

  // Create a "header" invoice
  j[msgType].cac_TaxTotal.forEach((t) => {
    // We'll validate each tax total manually here
    const amount = currencyjs(t.cbc_TaxAmount?.[0]?._).value;
    const currency = t.cbc_TaxAmount?.[0]?.$?.currencyID;
    if (!amount || !currency) {
      errors.push({
        errorLevel: 'ERROR',
        errorID: 'BR-CO-01',
        errorFieldName: '/:Invoice[1]/cac:TaxTotal[1]',
        test: '(exists(cbc:TaxAmount) and exists(cbc:TaxAmount/@currencyID))',
        errorText: '[BR-CO-01]-Tax total amount (BT-107) and currency (BT-108) must exist.'
      });
    }

    t.cac_TaxSubtotal.forEach((s) => {
      const taxableAmount = currencyjs(s.cbc_TaxableAmount?.[0]?._).value;
      const taxAmount = currencyjs(s.cbc_TaxAmount?.[0]?._).value;
      const taxCategory = s.cac_TaxCategory?.[0];
      const percent = currencyjs(taxCategory.cbc_Percent?.[0]?._).value;
      const id = taxCategory.cbc_ID?.[0]?._;

      if (!amount || !currency || !taxableAmount || !taxAmount || !percent || !id) {
        errors.push({
          errorLevel: 'ERROR',
          errorID: 'BR-CO-02',
          errorFieldName: '/:Invoice[1]/cac:TaxTotal[1]/cac:TaxSubtotal[1]',
          test: '(exists(cbc:TaxableAmount) and exists(cbc:TaxableAmount/@currencyID) and exists(cbc:TaxAmount) and exists(cbc:TaxAmount/@currencyID) and exists(cbc:Percent) and exists(cbc:ID))',
          errorText: '[BR-CO-02]-Tax total amount (BT-107), taxable amount (BT-108), tax amount (BT-109), tax category percent (BT-110) and tax category ID (BT-111) must exist.'
        });
      }
      sums[percent] = {};
      sums[percent].taxableAmount = currencyjs(sums.taxableAmount, { precision: 2 }).add(taxableAmount, { precision: 2 }).value;
      sums[percent].taxAmount = currencyjs(sums.taxAmount, { precision: 2 }).add(taxAmount, { precision: 2 }).value;
      sums[percent].total = currencyjs(sums.total, { precision: 2 }).add(taxableAmount, { precision: 2 }).add(taxAmount, { precision: 2 }).value;
      sums[percent].currency = currency;
      sums[percent].taxCategory = id;
      sums[percent].taxScheme = 'VAT';
      sums.percent ||= [];
      sums.percent.push(String(percent));
    });
  });

  const savedLines = JSON.stringify(j[msgType].cac_InvoiceLine); // remove inheritance from the original object
  // Construct invoice lines based on the tax totals only to validate the header
  j[msgType].cac_InvoiceLine = [];
  sums.percent.forEach((p) => {
    const taxSums = sums[p];
    if (!taxSums || !taxSums.taxableAmount || !taxSums.taxAmount || !taxSums.total) {
      errors.push({
        errorLevel: 'ERROR',
        errorID: 'BR-CO-04',
        errorFieldName: '/:Invoice[1]/cac:TaxTotal[1]/cac:TaxSubtotal[1]',
        test: '(exists(cbc:TaxableAmount) and exists(cbc:TaxableAmount/@currencyID) and exists(cbc:TaxAmount) and exists(cbc:TaxAmount/@currencyID) and exists(cbc:Percent) and exists(cbc:ID))',
        errorText: '[BR-CO-04]-Tax total amount (BT-107), taxable amount (BT-108), tax amount (BT-109), tax category percent (BT-110) and tax category ID (BT-111) must exist.'
      });
    }
    j[msgType].cac_InvoiceLine.push({
      cbc_ID: [{ _: String(p) }],
      cbc_InvoicedQuantity: [{
        _: '1',
        $: { unitCode: 'EA' }
      }],
      cbc_LineExtensionAmount: [{
        _: taxSums.taxableAmount,
        $: { currencyID: sums[p].currency }
      }],
      cac_Item: [{
        cbc_Name: [{ _: 'Tax category ' + sums[p].taxCategory }],
        cac_ClassifiedTaxCategory: [{
          cbc_ID: [{ _: sums[p].taxCategory }],
          cbc_Percent: [{ _: String(p) }],
          cac_TaxScheme: [{
            cbc_ID: [{ _: sums[p].taxScheme }]
          }]
        }]
      }],
      cac_Price: [{
        cbc_PriceAmount: [{
          _: taxSums.taxableAmount,
          $: { currencyID: sums[p].currency }
        }]
      }]
    });
  });

  // If we already have captured an error, don't call the validation service
  if (!errors.length) {
    console.time('PeppolValidation')
    const headerXML = (await convertUblJsonToUblXml(j)).replace(/cac_/g, ns.cac + ':').replace(/cbc_/g, ns.cbc + ':');
    const result = await validatePeppolXml(headerXML, msgType);
    console.timeEnd('PeppolValidation');
    if (result.success) {
      console.info('Validation successful!');
    } else {
      // If we got a validation error, we log it and return the result of teh header validation only
      console.error('Validation errors:', result);
      return result;
    }
  }

  console.time('ParseItems');
  j[msgType].cac_InvoiceLine = JSON.parse(savedLines); // restore the lines
  j[msgType].cac_InvoiceLine.forEach((i) => {
    // We'll validate each item manually here
    const id = i.cbc_ID?.[0]?._;
    const qty = currencyjs(i.cbc_InvoicedQuantity?.[0]?._ || 1).value;
    const unit = i.cbc_InvoicedQuantity?.[0]?.$?.unitCode;
    const price = currencyjs(i.cac_Price?.[0]?.cbc_PriceAmount?.[0]?._).value;
    let total = i.cbc_LineExtensionAmount?.[0]?._;
    sums.subTotal = currencyjs(sums.subTotal, { precision: 2 }).add(total, { precision: 2 }).value; // You would think `+=` would work as we add using two decimals, but it doesn't and we'll end up with e.g. `nnn.9000004686` or something
    if (!/^[0-9]{1,}(?:\.[0-9]{1,2})?$/.test(total)) {
      // If we have more than two decimals, this is not allowed...
      errors.push({
        errorLevel: 'ERROR',
        errorID: 'BR-CO-05',
        errorFieldName: '/:Invoice[1]/cac:InvoiceLine[1]/cbc:LineExtensionAmount[1]',
        test: '(exists(cbc:LineExtensionAmount) and xs:decimal(cbc:LineExtensionAmount) = xs:decimal(round(xs:decimal(cbc:LineExtensionAmount) * 10 * 10) div 100))',
        errorText: '[BR-CO-05]-Invoice line net amount (BT-135) must have a maximum of two decimals.'
      });
    }
    const totalCurrency = i.cbc_LineExtensionAmount?.[0]?.$?.currencyID;
    const item = i.cac_Item?.[0];
    const vat = currencyjs(item.cac_ClassifiedTaxCategory?.[0]?.cbc_Percent?.[0]?._).value;
    const taxCategory = item.cac_ClassifiedTaxCategory?.[0]?.cbc_ID?.[0]?._;
    if (vat && taxCategory) {
      if (!sums[vat] || !sums[vat].taxableAmount || !sums[vat].taxAmount || !sums[vat].currency || !sums[vat].taxCategory) {
        errors.push({
          errorLevel: 'ERROR',
          errorID: 'BR-CO-06',
          errorFieldName: '/:Invoice[1]/cac:InvoiceLine[1]/cac:Item[1]/cac:ClassifiedTaxCategory[1]',
          test: '(exists(cbc:Percent) and exists(cbc:ID))',
          errorText: '[BR-CO-06]-Tax category percent (BT-110) and tax category ID (BT-111) must exist.'
        });
      }
    }
    const name = item?.[0]?.cbc_Name;
    if (!name) {
      errors.push({
        errorLevel: 'ERROR',
        errorID: 'BR-CO-07',
        errorFieldName: '/:Invoice[1]/cac:InvoiceLine[1]/cac:Item[1]/cbc:Name[1]',
        test: 'exists(cbc:Name)',
        errorText: '[BR-CO-07]-Item name (BT-136) must exist.'
      });
    }

    if (i.cac_AllowanceCharge?.[0]) {
      console.warn('AllowanceCharge found, but not supported in this validation:', i.cac_AllowanceCharge[0]);
      const allowanceAmount = currencyjs(i.cac_AllowanceCharge[0].cbc_AllowanceChargeAmount?.[0]?._).multiply(String(i.cac_AllowanceCharge[0].cbc_ChargeIndicator) === 'true' ? 1 : -1).value;
      const lineTotalInclAllowance = currencyjs(price).multiply(qty).add(allowanceAmount, { precision: 2 }).value;
      if (lineTotalInclAllowance !== total) {
        console.error('[BR-CO-08]-Invoice line net amount (BT-135) must equal item net price (BT-134) * invoiced quantity (BT-132) + allowance/charge amount.');
        errors.push({
          errorLevel: 'ERROR',
          errorID: 'BR-CO-08',
          errorFieldName: '/:Invoice[1]/cac:InvoiceLine[1]/cac:AllowanceCharge[1]',
          test: '(xs:decimal(cbc:LineExtensionAmount) = xs:decimal(round(xs:decimal(cbc:InvoicedQuantity) * xs:decimal(cac:Price/cbc:PriceAmount) + xs:decimal(cac:AllowanceCharge/cbc:AllowanceChargeAmount)) * 10 * 10) div 100)',
          errorText: '[BR-CO-08]-Invoice line net amount (BT-135) must equal item net price (BT-134) * invoiced quantity (BT-132) + allowance/charge amount.'
        });
      }
    }

    if (!id || !qty || !unit || !price || !total || !totalCurrency || !item) {
      errors.push({
        errorLevel: 'ERROR',
        errorID: 'BR-CO-03',
        errorFieldName: '/:Invoice[1]/cac:InvoiceLine[1]',
        test: '(exists(cbc:ID) and exists(cbc:InvoicedQuantity) and exists(cbc:InvoicedQuantity/@unitCode) and exists(cac:Price/cbc:PriceAmount) and exists(cbc:LineExtensionAmount) and exists(cbc:LineExtensionAmount/@currencyID) and exists(cac:Item))',
        errorText: '[BR-CO-03]-Invoice line ID (BT-131), invoiced quantity (BT-132), unit code (BT-133), item net price (BT-134), invoice line net amount (BT-135) and item (BT-136) must exist.'
      });
    }
  });
  if(currencyjs(j[msgType].cac_LegalMonetaryTotal[0].cbc_LineExtensionAmount[0]._, { precision: 2 }).value !== sums.subTotal) {
    //console.log(currencyjs(j[msgType].cac_LegalMonetaryTotal[0].cbc_LineExtensionAmount[0]._, { precision: 2 }).value, '!==', sums.subTotal);
    console.error('[BR-CO-10]-Sum of Invoice line net amount (BT-106) = Σ Invoice line net amount (BT-131).');
    errors.push({
      errorLevel: 'ERROR',
      errorID: 'BR-CO-10',
      errorFieldName: '/:Invoice[1]',
      test: '(xs:decimal(cbc:LineExtensionAmount) = xs:decimal(round(sum(//(cac:InvoiceLine|cac:CreditNoteLine)/xs:decimal(cbc:LineExtensionAmount)) * 10 * 10) div 100))',
      errorText: '[BR-CO-10]-Sum of Invoice line net amount (BT-106) = Σ Invoice line net amount (BT-131).'
    });
  }

  console.timeEnd('ParseItems');

  return errors;
}

(async () => {
  console.time('ReadFile');
  const xmlData = await fs.readFileSync('./Large_Invoice_sample2.xml', 'utf-8');
  console.timeEnd('ReadFile');

  console.time('TOTAL');
  // const js = await convertUblXmlToUblJson(stripPeppolAttachments(xmlData));
  const msgType = xmlData.slice(-20).replace(/\s/g, '').match(/<\/([a-z]+)>/i).at(1);
  const ns = getNamespaces(xmlData.slice(0, 800));

  // To make our life easier...
  const regExpCac = new RegExp(`${ns.cac}:`, 'g');
  const regExpCbc = new RegExp(`${ns.cbc}:`, 'g');
  const message = xmlData.replace(regExpCac, 'cac_').replace(regExpCbc, 'cbc_');

  // console.log('byteSize XML:', byteSize(message));
  console.time('XML2JS');
  j = await convertUblXmlToUblJson(stripPeppolAttachments(message));
  // console.log(JSON.stringify(j, null, 2));
  console.timeEnd('XML2JS');

  const response = await stripPeppolItems(j, msgType, ns);
  console.timeEnd('TOTAL');
  return response;
})();
