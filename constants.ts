
declare global {
  var __app_id: string | undefined;
}

export const TEACHER_SECRET_CODE = "SCHOOL_ADMIN";
export const SUPER_ADMIN_KEY = "codegeniushub@gmail.com/admin";
export const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'school-result-gen';

export const THEME_COLORS = [
  { name: 'Imperial Purple', hex: '#6b21a8' },
  { name: 'Classic Green', hex: '#15803d' },
  { name: 'Royal Blue', hex: '#1e40af' },
  { name: 'Crimson Red', hex: '#b91c1c' },
  { name: 'Burnt Orange', hex: '#c2410c' },
  { name: 'Teal', hex: '#0f766e' },
  { name: 'Midnight Black', hex: '#111827' },
  { name: 'Maroon', hex: '#7f1d1d' },
  { name: 'Navy', hex: '#172554' }
];

export const AFFECTIVE_TRAITS = [
  "Punctuality", "Neatness", "Politeness", "Honesty", 
  "Leadership", "Attentiveness", "Self Control", "Cooperation"
];

export const PSYCHOMOTOR_SKILLS = [
  "Handwriting", "Verbal Fluency", "Games & Sports", 
  "Handling Tools", "Drawing & Painting", "Musical Skills"
];

// Sort subjects alphabetically, but remove "Others" first
const rawSubjects = [
  "Number Work", "Letter Work", "Health Habits", "Social Norms", "Rhymes", "Creative Arts", 
  "Phonics", "Handwriting", "Verbal Reasoning", "Quantitative Reasoning", "Vocational Aptitude", 
  "Basic Science & Technology", "National Values", "History", "Religion & National Values",
  "Mathematics", "English Language", "Civic Education", "Biology", "Physics", "Chemistry", 
  "Literature-in-English", "Government", "Economics", "Geography", "Agricultural Science", 
  "Further Mathematics", "Technical Drawing", "Commerce", "Financial Accounting", 
  "Christian Religious Studies", "Islamic Religious Studies", "French", 
  "Yoruba", "Igbo", "Hausa", "Computer Studies", "Data Processing", 
  "Physical & Health Education", "Visual Arts", "Music", "Home Management", 
  "Food & Nutrition", "Clothing & Textiles", "Fisheries", "Animal Husbandry", 
  "Marketing", "Store Management", "Office Practice", "Insurance", "Book Keeping",
  "Basic Science", "Basic Technology", "Social Studies", "Business Studies", 
  "Security Education", "Catering Craft Practice", "Dyeing & Bleaching", "Photography",
  "Painting & Decorating", "Electrical Installation", "Auto Mechanics",
  "Others"
];

// Filter out 'Others', sort the rest, then push 'Others' to the end
const sortedSubjects = rawSubjects.filter(s => s !== "Others").sort();
sortedSubjects.push("Others");

export const ALL_NIGERIAN_SUBJECTS = sortedSubjects;

export const CLASS_LEVELS = [
  "Nursery 1", "Nursery 2", "Nursery 3",
  "Basic 1", "Basic 2", "Basic 3", "Basic 4", "Basic 5",
  "JSS 1", "JSS 2", "JSS 3",
  "SSS 1", "SSS 2", "SSS 3"
];
