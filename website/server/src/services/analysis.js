const fs = require('fs/promises');
const path = require('path');
const pdfParse = require('pdf-parse');

const SKILL_DICTIONARY = [
  'javascript',
  'react',
  'node',
  'express',
  'mongodb',
  'sql',
  'html',
  'css',
  'tailwind',
  'docker',
  'git',
  'typescript',
  'python',
  'c++',
  'cpp',
  'huffman',
  'algorithm',
  'data structures',
  'problem solving',
  'rest api',
  'testing',
  'security',
  'linux',
  'pdf',
];

async function readDocumentText(filePath) {
  const buffer = await fs.readFile(filePath);
  if (path.extname(filePath).toLowerCase() === '.pdf') {
    const parsed = await pdfParse(buffer);
    return parsed.text || '';
  }

  return buffer.toString('utf8');
}

function extractSkills(text) {
  const normalized = text.toLowerCase();
  return SKILL_DICTIONARY.filter((skill) => normalized.includes(skill.toLowerCase()));
}

async function analyzeResume(filePath, jobDescription = '') {
  const resumeText = await readDocumentText(filePath);
  const resumeSkills = extractSkills(resumeText);
  const jobSkills = extractSkills(jobDescription);
  const overlap = jobSkills.filter((skill) => resumeSkills.includes(skill));
  const missingKeywords = jobSkills.filter((skill) => !resumeSkills.includes(skill));

  const sectionBonus = ['experience', 'education', 'projects', 'skills'].reduce((bonus, marker) => {
    return bonus + (resumeText.toLowerCase().includes(marker) ? 5 : 0);
  }, 0);

  const scoreBase = jobSkills.length > 0 ? (overlap.length / jobSkills.length) * 80 : Math.min(60, resumeSkills.length * 4);
  const atsScore = Math.min(100, Math.round(scoreBase + sectionBonus + Math.min(15, resumeText.length / 800)));

  return {
    atsScore,
    extractedSkills: resumeSkills,
    matchedKeywords: overlap,
    missingKeywords,
    summary: resumeText.slice(0, 400).replace(/\s+/g, ' ').trim(),
  };
}

async function recommendCompression(filePath) {
  const buffer = await fs.readFile(filePath);
  const frequency = new Map();
  let repeatCount = 0;

  for (let index = 0; index < buffer.length; index += 1) {
    const byte = buffer[index];
    frequency.set(byte, (frequency.get(byte) || 0) + 1);
    if (index > 0 && buffer[index] === buffer[index - 1]) {
      repeatCount += 1;
    }
  }

  let entropy = 0;
  for (const count of frequency.values()) {
    const probability = count / buffer.length;
    entropy -= probability * Math.log2(probability);
  }

  const repetitionIndex = buffer.length === 0 ? 0 : repeatCount / buffer.length;
  const recommendation = entropy < 4.5 || repetitionIndex > 0.25 ? 'RLE' : 'Huffman';

  return {
    recommendation,
    entropy: Number(entropy.toFixed(4)),
    repetitionIndex: Number(repetitionIndex.toFixed(4)),
    fileSize: buffer.length,
  };
}

module.exports = {
  analyzeResume,
  recommendCompression,
};
