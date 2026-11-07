const fs = require('fs');
const path = require('path');

const pagePath = path.resolve(__dirname, '../../admin-web/src/pages/seller/SellerProfilePage.jsx');
let content = fs.readFileSync(pagePath, 'utf8');

if (!content.includes('submitSellerKyb')) {
  // Update imports
  content = content.replace(
    "import { getMySellerProfile, updateMySellerProfile } from '../../api/usersApi';",
    "import { getMySellerProfile, updateMySellerProfile, submitSellerKyb } from '../../api/usersApi';\r\nimport { ShieldCheck, FileText, Award } from 'lucide-react';"
  );

  // Add KYB states
  const stateInsert = "  const [contactPhone, setContactPhone] = useState('');\r\n" +
    "  const [commReg, setCommReg] = useState('');\r\n" +
    "  const [taxCard, setTaxCard] = useState('');\r\n" +
    "  const [nationalId, setNationalId] = useState('');\r\n" +
    "  const [kybDoc, setKybDoc] = useState('');\r\n" +
    "  const [kybStatus, setKybStatus] = useState('Unverified');\r\n" +
    "  const [kybRejection, setKybRejection] = useState('');\r\n" +
    "  const [submittingKyb, setSubmittingKyb] = useState(false);\r\n" +
    "  const [kybFeedback, setKybFeedback] = useState(null);";

  content = content.replace("  const [contactPhone, setContactPhone] = useState('');", stateInsert);

  // Set fields on load
  const loadInsert = "          setContactPhone(profRes.data.contactPhone || '');\r\n" +
    "          setCommReg(profRes.data.commercialRegisterNumber || '');\r\n" +
    "          setTaxCard(profRes.data.taxCardNumber || '');\r\n" +
    "          setNationalId(profRes.data.nationalIdNumber || '');\r\n" +
    "          setKybDoc(profRes.data.kybDocumentUrl || '');\r\n" +
    "          setKybStatus(profRes.data.kybStatus || 'Unverified');\r\n" +
    "          setKybRejection(profRes.data.kybRejectionReason || '');";

  content = content.replace("          setContactPhone(profRes.data.contactPhone || '');", loadInsert);

  // Add handleKybSubmit
  const handlerCode = "  const handleKybSubmit = async (e) => {\r\n" +
    "    e.preventDefault();\r\n" +
    "    setKybFeedback(null);\r\n" +
    "    setSubmittingKyb(true);\r\n" +
    "    try {\r\n" +
    "      const res = await submitSellerKyb({\r\n" +
    "        commercialRegisterNumber: commReg.trim(),\r\n" +
    "        taxCardNumber: taxCard.trim(),\r\n" +
    "        nationalIdNumber: nationalId.trim(),\r\n" +
    "        kybDocumentUrl: kybDoc.trim(),\r\n" +
    "      });\r\n" +
    "      setKybStatus(res.data?.kybStatus || 'Pending');\r\n" +
    "      setKybFeedback({\r\n" +
    "        type: 'success',\r\n" +
    "        text: isRTL ? 'تم إرسال مستندات التوثيق بنجاح وهي قيد المراجعة' : 'KYB verification submitted and pending review',\r\n" +
    "      });\r\n" +
    "    } catch (err) {\r\n" +
    "      setKybFeedback({\r\n" +
    "        type: 'error',\r\n" +
    "        text: err?.response?.data?.error || (isRTL ? 'فشل إرسال التوثيق' : 'Failed to submit KYB'),\r\n" +
    "      });\r\n" +
    "    } finally {\r\n" +
    "      setSubmittingKyb(false);\r\n" +
    "    }\r\n" +
    "  };\r\n\r\n";

  content = content.replace("  const handleSave = async (e) => {", handlerCode + "  const handleSave = async (e) => {");

  // Add KYB JSX at the bottom of the form / card
  const kybJsx = "\r\n      {/* KYB Business Verification Card (GAP-SEL-05) */}\r\n" +
    "      <div className=\"border-t border-slate-100 pt-6 mt-6 space-y-4\">\r\n" +
    "        <div className=\"flex items-center justify-between pb-2\">\r\n" +
    "          <div className=\"flex items-center gap-3\">\r\n" +
    "            <div className=\"p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm\">\r\n" +
    "              <ShieldCheck className=\"w-5 h-5\" />\r\n" +
    "            </div>\r\n" +
    "            <div>\r\n" +
    "              <h3 className=\"font-black text-slate-900 text-sm\">\r\n" +
    "                {isRTL ? 'توثيق الهوية التجارية والضريبية (KYB)' : 'Business Verification (KYB)'}\r\n" +
    "              </h3>\r\n" +
    "              <p className=\"text-xs text-slate-500\">\r\n" +
    "                {isRTL ? 'تسجيل السجل التجاري والبطاقة الضريبية والرقم القومي لاعتماد المتجر' : 'Register Commercial ID and Tax Card for store verification'}\r\n" +
    "              </p>\r\n" +
    "            </div>\r\n" +
    "          </div>\r\n" +
    "          <div>\r\n" +
    "            {kybStatus === 'Verified' && (\r\n" +
    "              <span className=\"inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800\">\r\n" +
    "                <Award className=\"w-3.5 h-3.5 text-emerald-600\" />\r\n" +
    "                {isRTL ? 'موثق تجارياً' : 'Verified'}\r\n" +
    "              </span>\r\n" +
    "            )}\r\n" +
    "            {kybStatus === 'Pending' && (\r\n" +
    "              <span className=\"inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800\">\r\n" +
    "                {isRTL ? 'قيد المراجعة' : 'Pending Review'}\r\n" +
    "              </span>\r\n" +
    "            )}\r\n" +
    "            {kybStatus === 'Rejected' && (\r\n" +
    "              <span className=\"inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800\">\r\n" +
    "                {isRTL ? 'مرفوض' : 'Rejected'}\r\n" +
    "              </span>\r\n" +
    "            )}\r\n" +
    "            {kybStatus === 'Unverified' && (\r\n" +
    "              <span className=\"inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700\">\r\n" +
    "                {isRTL ? 'غير موثق' : 'Unverified'}\r\n" +
    "              </span>\r\n" +
    "            )}\r\n" +
    "          </div>\r\n" +
    "        </div>\r\n" +
    "        {kybRejection && (\r\n" +
    "          <div className=\"p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-semibold\">\r\n" +
    "            {isRTL ? `سبب الرفض: ${kybRejection}` : `Rejection reason: ${kybRejection}`}\r\n" +
    "          </div>\r\n" +
    "        )}\r\n" +
    "        {kybFeedback && (\r\n" +
    "          <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${kybFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>\r\n" +
    "            <span>{kybFeedback.text}</span>\r\n" +
    "          </div>\r\n" +
    "        )}\r\n" +
    "        <form onSubmit={handleKybSubmit} className=\"space-y-3\">\r\n" +
    "          <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-3\">\r\n" +
    "            <div>\r\n" +
    "              <label className=\"block text-xs font-bold text-slate-700 mb-1\">\r\n" +
    "                {isRTL ? 'رقم السجل التجاري' : 'Commercial Register Number'}\r\n" +
    "              </label>\r\n" +
    "              <input type=\"text\" value={commReg} onChange={(e) => setCommReg(e.target.value)} placeholder=\"123456\" className=\"w-full px-3 py-2 rounded-xl border border-slate-300 text-xs\" />\r\n" +
    "            </div>\r\n" +
    "            <div>\r\n" +
    "              <label className=\"block text-xs font-bold text-slate-700 mb-1\">\r\n" +
    "                {isRTL ? 'رقم البطاقة الضريبية' : 'Tax Card Number'}\r\n" +
    "              </label>\r\n" +
    "              <input type=\"text\" value={taxCard} onChange={(e) => setTaxCard(e.target.value)} placeholder=\"100-200-300\" className=\"w-full px-3 py-2 rounded-xl border border-slate-300 text-xs\" />\r\n" +
    "            </div>\r\n" +
    "            <div>\r\n" +
    "              <label className=\"block text-xs font-bold text-slate-700 mb-1\">\r\n" +
    "                {isRTL ? 'الرقم القومي لصاحب العمل' : 'National ID Number'}\r\n" +
    "              </label>\r\n" +
    "              <input type=\"text\" value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder=\"2900101...\" className=\"w-full px-3 py-2 rounded-xl border border-slate-300 text-xs\" />\r\n" +
    "            </div>\r\n" +
    "            <div>\r\n" +
    "              <label className=\"block text-xs font-bold text-slate-700 mb-1\">\r\n" +
    "                {isRTL ? 'رابط ملف السجل التجاري / البطاقة' : 'Document URL (PDF/Image)'}\r\n" +
    "              </label>\r\n" +
    "              <input type=\"url\" value={kybDoc} onChange={(e) => setKybDoc(e.target.value)} placeholder=\"https://...\" className=\"w-full px-3 py-2 rounded-xl border border-slate-300 text-xs\" />\r\n" +
    "            </div>\r\n" +
    "          </div>\r\n" +
    "          <button type=\"submit\" disabled={submittingKyb} className=\"px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50\">\r\n" +
    "            <FileText className=\"w-4 h-4\" />\r\n" +
    "            <span>{submittingKyb ? (isRTL ? 'جاري الإرسال...' : 'Submitting...') : (isRTL ? 'إرسال بيانات التوثيق' : 'Submit Verification')}</span>\r\n" +
    "          </button>\r\n" +
    "        </form>\r\n" +
    "      </div>\r\n";

  content = content.replace("      </form>\r\n    </div>", "      </form>" + kybJsx + "    </div>");
  fs.writeFileSync(pagePath, content, 'utf8');
  console.log('✓ Added KYB section to SellerProfilePage.jsx');
}
