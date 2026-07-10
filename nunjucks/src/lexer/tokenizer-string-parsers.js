export const extractBeginChars = (tags) => 
  tags.BLOCK_START.charAt(0) + 
  tags.VARIABLE_START.charAt(0) + 
  tags.COMMENT_START.charAt(0) + 
  tags.COMMENT_END.charAt(0);

export const extractWhileInCharSet = (str, startIndex, charSet) => {
  let result = '';
  for (let i = startIndex; i < str.length; i++) {
    if (charSet.indexOf(str[i]) === -1) break;
    result += str[i];
  }
  return result;
};

export const extractUntilCharSet = (str, startIndex, charSet) => {
  let result = '';
  for (let i = startIndex; i < str.length; i++) {
    if (charSet.indexOf(str[i]) !== -1) break;
    result += str[i];
  }
  return result;
};

export const parseEscapeChar = (char) => {
  const escapes = { n: '\n', t: '\t', r: '\r' };
  return escapes[char] ?? char;
};

export const parseStringContent = (str, startIndex, delimiter) => {
  let result = '';
  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];
    if (char === '\\' && i + 1 < str.length) {
      result += parseEscapeChar(str[i + 1]);
      i++;
    } else if (char === delimiter) {
      break;
    } else {
      result += char;
    }
  }
  return result;
};

export const parseRegexContent = (str, startIndex, flags, isValidRegexFlag) => {
  let body = '';
  let i = startIndex;
  
  for (; i < str.length; i++) {
    if (str[i] === '/' && str[i - 1] !== '\\') break;
    body += str[i];
  }
  
  i++;
  
  let extractedFlags = '';
  for (; i < str.length; i++) {
    if (isValidRegexFlag(str[i], flags)) {
      extractedFlags += str[i];
    } else {
      break;
    }
  }
  
  return { body, flags: extractedFlags, consumed: i - startIndex };
};
