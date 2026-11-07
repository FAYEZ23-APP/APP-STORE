import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';
import { reportClientError } from '../utils/telemetry';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    reportClientError(error, { componentStack: errorInfo?.componentStack?.slice(0, 500) });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isArabic =
        typeof document !== 'undefined' &&
        (document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl');

      return (
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className="min-h-screen bg-[#1F2329] text-[#ECE9E6] flex items-center justify-center p-4 selection:bg-[#C8102E] selection:text-white"
        >
          <div className="max-w-xl w-full bg-[#171A1F] border border-[#2B303A] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            {/* Error Icon */}
            <div className="w-16 h-16 rounded-3xl bg-[#C8102E]/10 border border-[#C8102E]/25 text-[#C8102E] mx-auto flex items-center justify-center shadow-lg">
              <ShieldAlert className="w-8 h-8" />
            </div>

            {/* Error Message */}
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {isArabic ? 'حدث خطأ غير متوقع في واجهة المتجر' : 'An Unexpected Error Occurred'}
              </h2>
              <p className="text-xs sm:text-sm text-[#ECE9E6]/70 leading-relaxed max-w-md mx-auto">
                {isArabic
                  ? 'نعتذر عن هذا الخطأ المؤقت. بياناتك الشخصية وسجل طلباتك في أمان تام وفقاً لقانون حماية البيانات المصري 151/2020.'
                  : 'We apologize for this inconvenience. Your session and personal data remain strictly protected.'}
              </p>
            </div>

            {/* Dev Mode Debug Info */}
            {import.meta.env.DEV && this.state.error && (
              <div className="text-start bg-[#1F2329] p-3.5 rounded-2xl border border-[#C8102E]/30 text-xs font-mono text-red-300 overflow-x-auto max-h-40">
                <span className="font-bold text-[#C8102E] block mb-1">
                  Debug Details (Dev Only):
                </span>
                <p className="whitespace-pre-wrap">{this.state.error.toString()}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#C8102E] hover:bg-[#A80D26] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#C8102E]/25 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{isArabic ? 'إعادة تحميل الصفحة' : 'Reload Page'}</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#242931] hover:bg-[#2F3642] active:scale-95 text-[#ECE9E6] font-bold text-xs flex items-center justify-center gap-2 border border-[#3A404D] transition-all"
              >
                <Home className="w-4 h-4" />
                <span>{isArabic ? 'العودة للرئيسية' : 'Back to Storefront'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
