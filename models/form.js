import { Schema, model } from 'mongoose'

const formSchema = new Schema({
  formNumber: {
    type: String,
    required: [true, '請輸入表單編號']
  },
  clientName: {
    type: String
  },
  formTemplate: {
    type: Schema.Types.ObjectId,
    ref: 'formTemplates',
    required: [true, '請選擇表單模板']
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: [true, '請選擇創建者']
  },
  pdfUrl: {
    type: String,
    required: [true, '請上傳 PDF 檔案']
  }
}, {
  timestamps: true
})

// 複合索引，確保同一個模板下的單號不重複
formSchema.index({ formNumber: 1, formTemplate: 1 }, { unique: true })

export default model('forms', formSchema)
