'use client'

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Upload, CheckCircle, Loader, FileText, Weight } from 'lucide-react'
import { Button } from '@/components/ui/button';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast'
import { createReport, createUser, getRecentReports, getUserByEmail } from '@/utils/db/actions';
import LocationSearch from '@/components/LocationSearch';

const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

export default function ReportPage() {
    const [user, setUser] = useState('') as any;
    const router = useRouter();

    const [reports, setReports] = useState<Array<{
        id: string;
        location: string;
        wasteType: string;
        amount: string;
        createdAt: string;
    }>>([]);

    const [newReport, setNewReport] = useState({
        location: '',
        type: '',
        amount: '',
    })

    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'failure'>('idle')
    const [verificationResult, setVerificationResult] = useState<{
        wasteType: string;
        quantity: string;
        confidence: number;
    } | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setNewReport({ ...newReport, [name]: value })
    }

    const handleLocationSelect = (location: string) => {
        setNewReport({ ...newReport, location: location });
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0]
            setFile(selectedFile)
            const reader = new FileReader()
            reader.onload = (e) => {
                setPreview(e.target?.result as string)
            }
            reader.readAsDataURL(selectedFile)
        }
    }

    const readFileAsBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleVerify = async () => {
        if (!file) return

        if (!geminiApiKey) {
            console.error("Gemini API key not found");
            toast.error("API key not found. Please check your environment variables.");
            return;
        }

        setVerificationStatus('verifying')

        try {
            const genAI = new GoogleGenerativeAI(geminiApiKey!);
            const base64Data = await readFileAsBase64(file);

            const imageParts = [
                {
                    inlineData: {
                        data: base64Data.split(',')[1],
                        mimeType: file.type,
                    },
                },
            ];

            const prompt = `You are an expert in waste management and recycling. Analyze this image and provide:
                1. The type of waste (e.g., plastic, paper, glass, metal, organic)
                2. An estimate of the quantity or amount (in kg or liters)
                3. Your confidence level in this assessment (as a percentage)
        
                Respond in JSON format like this:
                {
                    "wasteType": "type of waste",
                    "quantity": "estimated quantity with unit",
                    "confidence": confidence level as a number between 0 and 1
                }`;

            const refinedModelNames = [
                "gemini-2.0-flash",           // Confirmed stable
                "gemini-2.5-flash",           // Confirmed stable
                "gemini-2.5-pro",             // Confirmed stable with higher capacity
                "gemini-2.0-flash-001",       // Explicit version
                "gemini-2.0-flash-lite",      // Lightweight option
                "gemini-2.0-flash-exp",       // Experimental fallback
                "gemini-2.0-flash-lite-preview-02-05" // Latest preview
            ];

            // Overwrite modelNames for execution
            const modelsToTry = refinedModelNames;

            let text = '';
            const errors: string[] = [];
            let success = false;

            for (const modelName of modelsToTry) {
                try {
                    console.log(`Attempting verification with model: ${modelName}`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent([prompt, ...imageParts]);
                    const response = await result.response;
                    const candidate = response.text();

                    if (candidate && candidate.trim().length > 0) {
                        text = candidate;
                        success = true;
                        break; // Exit loop on success
                    } else {
                        console.warn(`Model ${modelName} returned empty text.`);
                        errors.push(`[${modelName}]: Empty response`);
                    }
                } catch (error: any) {
                    console.warn(`Model ${modelName} failed:`, error.message);
                    errors.push(`[${modelName}]: ${error.message}`);
                }
            }

            if (!success) {
                console.error("All models failed:", errors);
                throw new Error(`All models failed. Details: ${errors.join('; ')}`);
            }



            try {
                // Sanitize the text to remove markdown code blocks if present
                const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

                if (!cleanedText) {
                    throw new Error("Received empty response from AI model");
                }

                const parsedResult = JSON.parse(cleanedText);

                const finalResult = Array.isArray(parsedResult) ? parsedResult[0] : parsedResult;

                // Fix quantity: Remove last digit / reduce magnitude as requested
                if (finalResult.quantity) {
                    const match = finalResult.quantity.match(/(\d+(\.\d+)?)(.*)/);
                    if (match) {
                        const numVal = parseFloat(match[1]);
                        const unit = match[3] || '';

                        // Strict interpretation of "remove last digit" for integers, or /10 generally
                        let fixedNum = numVal;
                        if (!match[1].includes('.') && match[1].length > 1) {
                            // strictly remove last digit for multi-digit integers
                            fixedNum = parseFloat(match[1].slice(0, -1));
                        } else if (numVal >= 10) {
                            // Fallback for decimals >= 10
                            fixedNum = Math.floor(numVal / 10);
                        } else {
                            // For small numbers (<10), just divide by 2 to be safe
                            fixedNum = parseFloat((numVal / 2).toFixed(2));
                            // Avoid 0
                            if (fixedNum <= 0) fixedNum = 0.1;
                        }

                        finalResult.quantity = `${fixedNum}${unit}`;
                    }
                }

                if (finalResult.wasteType && finalResult.quantity && finalResult.confidence) {
                    setVerificationResult(finalResult);
                    setVerificationStatus('success');
                    setNewReport({
                        ...newReport,
                        type: finalResult.wasteType,
                        amount: finalResult.quantity
                    });
                } else {
                    console.error('Invalid verification result:', finalResult);
                    setVerificationStatus('failure');
                }
            } catch (error) {
                console.error('Error parsing JSON response:', error)
                setVerificationStatus('failure')
            }
        } catch (error: any) {
            console.error('Error verifying report:', error);
            setVerificationStatus('failure');



            // Enhanced error handling
            const errorMessage = error.message || '';
            if (errorMessage.includes('429') || errorMessage.includes('Quota')) {
                toast.error('Usage limit exceeded. Please try again later.');
            } else {
                toast.error(`Verification failed. Check console for details.`);
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (verificationStatus !== 'success' || !user) {
            toast.error('Please verify the waste before submitting or log in.');
            return;
        }

        setIsSubmitting(true);
        try {
            const report = await createReport(
                user.id,
                newReport.location,
                newReport.type,
                newReport.amount,
                preview || undefined,
                verificationResult ? JSON.stringify(verificationResult) : undefined
            ) as any;

            const formattedReport = {
                id: report.id,
                location: report.location,
                wasteType: report.wasteType,
                amount: report.amount,
                createdAt: report.createdAt.toISOString().split('T')[0]
            };

            setReports([formattedReport, ...reports]);
            setNewReport({ location: '', type: '', amount: '' });
            setFile(null);
            setPreview(null);
            setVerificationStatus('idle');
            setVerificationResult(null);


            toast.success(`Report submitted successfully! You've earned points for reporting waste.`);
        } catch (error) {
            console.error('Error submitting report:', error);
            toast.error('Failed to submit report. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        const checkUser = async () => {
            const email = localStorage.getItem('userEmail');
            if (email) {
                let user = await getUserByEmail(email);
                if (!user) {
                    user = await createUser(email, 'Anonymous User');
                }
                setUser(user);

                const recentReports = await getRecentReports();
                const formattedReports = recentReports.map(report => ({
                    ...report,
                    createdAt: report.createdAt.toISOString().split('T')[0]
                }));
                setReports(formattedReports);
            } else {
                router.push('/login');
            }
        };
        checkUser();
    }, [router]);

    return (
        <div className="pt-32 px-8 pb-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-semibold mb-6 text-gray-800">Report waste</h1>

            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg mb-12">
                <div className="mb-8">
                    <label htmlFor="waste-image" className="block text-lg font-medium text-gray-700 mb-2">
                        Upload Waste Image
                    </label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-green-500 transition-colors duration-300">
                        <div className="space-y-1 text-center">
                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                                <label
                                    htmlFor="waste-image"
                                    className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-500"
                                >
                                    <span>Upload a file</span>
                                    <input id="waste-image" name="waste-image" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                                </label>
                                <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                        </div>
                    </div>
                </div>

                {preview && (
                    <div className="mt-4 mb-8">
                        <img src={preview} alt="Waste preview" className="max-w-full h-auto rounded-xl shadow-md" />
                    </div>
                )}

                <Button
                    type="button"
                    onClick={handleVerify}
                    className="w-full mb-8 bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg rounded-xl transition-colors duration-300"
                    disabled={!file || verificationStatus === 'verifying'}
                >
                    {verificationStatus === 'verifying' ? (
                        <>
                            <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                            Verifying...
                        </>
                    ) : 'Verify Waste'}
                </Button>

                {verificationStatus === 'success' && verificationResult && (
                    <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-8 rounded-r-xl">
                        <div className="flex items-center">
                            <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
                            <div>
                                <h3 className="text-lg font-medium text-green-800">Verification Successful</h3>
                                <div className="mt-2 text-sm text-green-700">
                                    <p>Waste Type: {verificationResult.wasteType}</p>
                                    <p>Quantity: {verificationResult.quantity}</p>
                                    <p>Confidence: {(verificationResult.confidence * 100).toFixed(2)}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <LocationSearch
                            onLocationSelect={handleLocationSelect}
                            initialValue={newReport.location}
                        />
                    </div>
                    <div>
                        <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Waste Type</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FileText className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                id="type"
                                name="type"
                                value={newReport.type}
                                onChange={handleInputChange}
                                required
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
                                placeholder="Verified waste type"
                                readOnly
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Estimated Amount</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Weight className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                id="amount"
                                name="amount"
                                value={newReport.amount}
                                onChange={handleInputChange}
                                required
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
                                placeholder="Verified amount"
                                readOnly
                            />
                        </div>
                    </div>
                </div>
                <Button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg rounded-xl transition-colors duration-300 flex items-center justify-center"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                            Submitting...
                        </>
                    ) : 'Submit Report'}
                </Button>
            </form>

            <h2 className="text-3xl font-semibold mb-6 text-gray-800">Recent Reports</h2>
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-r from-green-500 to-green-600 p-6">
                    <h2 className="text-xl font-semibold text-white">Recent Reports</h2>
                </div>
                <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reports.map((report) => (
                                <tr key={report.id} className="hover:bg-gray-50 transition-colors duration-200">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        <div className="flex items-center">
                                            <MapPin className="w-4 h-4 mr-2 text-green-500" />
                                            {report.location}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        <div className="flex items-center">
                                            <FileText className="w-4 h-4 mr-2 text-blue-500" />
                                            {report.wasteType}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        <div className="flex items-center">
                                            <Weight className="w-4 h-4 mr-2 text-purple-500" />
                                            {report.amount}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.createdAt}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}