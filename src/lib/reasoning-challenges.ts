/**
 * Pool of reasoning challenges (code bugs to find)
 */

export interface ReasoningChallenge {
  id: string;
  language: string;
  code: string;
  answer: {
    line: number;
    issue: string;
    fix: string;
  };
  difficulty: "easy" | "standard" | "hard";
}

export const reasoningChallenges: ReasoningChallenge[] = [
  // Easy challenges
  {
    id: "factorial-base",
    language: "python",
    code: `def factorial(n):
    if n == 0:
        return 0
    return n * factorial(n - 1)`,
    answer: {
      line: 3,
      issue: "Base case returns 0 instead of 1",
      fix: "return 1",
    },
    difficulty: "easy",
  },
  {
    id: "sum-array-off-by-one",
    language: "python",
    code: `def sum_array(arr):
    total = 0
    for i in range(1, len(arr)):
        total += arr[i]
    return total`,
    answer: {
      line: 3,
      issue: "Loop starts at index 1, missing first element",
      fix: "for i in range(len(arr)):",
    },
    difficulty: "easy",
  },
  {
    id: "max-value-init",
    language: "python",
    code: `def find_max(numbers):
    max_val = 0
    for num in numbers:
        if num > max_val:
            max_val = num
    return max_val`,
    answer: {
      line: 2,
      issue: "Initial value 0 fails for all-negative arrays",
      fix: "max_val = float('-inf')  # or max_val = numbers[0]",
    },
    difficulty: "easy",
  },
  {
    id: "string-reverse",
    language: "javascript",
    code: `function reverseString(str) {
    let reversed = "";
    for (let i = str.length; i >= 0; i--) {
        reversed += str[i];
    }
    return reversed;
}`,
    answer: {
      line: 3,
      issue: "Loop starts at str.length which is out of bounds (undefined)",
      fix: "for (let i = str.length - 1; i >= 0; i--)",
    },
    difficulty: "easy",
  },
  // Standard challenges
  {
    id: "binary-search-mid",
    language: "python",
    code: `def binary_search(arr, target):
    left, right = 0, len(arr)
    while left < right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid
        else:
            right = mid
    return -1`,
    answer: {
      line: 8,
      issue: "left = mid can cause infinite loop when left + 1 == right",
      fix: "left = mid + 1",
    },
    difficulty: "standard",
  },
  {
    id: "linked-list-cycle",
    language: "python",
    code: `def has_cycle(head):
    slow = head
    fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next
        if slow == fast:
            return True
    return False`,
    answer: {
      line: 6,
      issue: "fast should move two steps, not one",
      fix: "fast = fast.next.next",
    },
    difficulty: "standard",
  },
  {
    id: "merge-sorted-arrays",
    language: "javascript",
    code: `function mergeSorted(arr1, arr2) {
    const result = [];
    let i = 0, j = 0;
    while (i < arr1.length && j < arr2.length) {
        if (arr1[i] < arr2[j]) {
            result.push(arr1[i++]);
        } else {
            result.push(arr2[j++]);
        }
    }
    return result;
}`,
    answer: {
      line: 11,
      issue: "Missing remaining elements from arr1 or arr2 after loop",
      fix: "return result.concat(arr1.slice(i)).concat(arr2.slice(j));",
    },
    difficulty: "standard",
  },
  {
    id: "async-loop",
    language: "javascript",
    code: `async function processItems(items) {
    const results = [];
    for (let i = 0; i < items.length; i++) {
        const result = fetchData(items[i]);
        results.push(result);
    }
    return results;
}`,
    answer: {
      line: 4,
      issue: "Missing await - fetchData is async but not awaited",
      fix: "const result = await fetchData(items[i]);",
    },
    difficulty: "standard",
  },
  {
    id: "shallow-copy",
    language: "python",
    code: `def append_to_list(item, target_list=[]):
    target_list.append(item)
    return target_list`,
    answer: {
      line: 1,
      issue: "Mutable default argument - list persists between calls",
      fix: "def append_to_list(item, target_list=None): target_list = target_list or []",
    },
    difficulty: "standard",
  },
  // Hard challenges
  {
    id: "race-condition",
    language: "python",
    code: `class Counter:
    def __init__(self):
        self.count = 0
    
    def increment(self):
        current = self.count
        self.count = current + 1`,
    answer: {
      line: 6,
      issue: "Race condition - read and write not atomic, threads can overwrite",
      fix: "Use threading.Lock() or atomic operations",
    },
    difficulty: "hard",
  },
  {
    id: "floating-point",
    language: "javascript",
    code: `function calculateTotal(prices) {
    let total = 0;
    for (const price of prices) {
        total += price;
    }
    return total === 0.3;  // Check if total is exactly 0.30
}
// Called with: calculateTotal([0.1, 0.2])`,
    answer: {
      line: 6,
      issue: "Floating point comparison - 0.1 + 0.2 !== 0.3 in IEEE 754",
      fix: "return Math.abs(total - 0.3) < 0.0001  // Use epsilon comparison",
    },
    difficulty: "hard",
  },
  {
    id: "sql-injection",
    language: "python",
    code: `def get_user(username):
    query = f"SELECT * FROM users WHERE username = '{username}'"
    return db.execute(query)`,
    answer: {
      line: 2,
      issue: "SQL injection vulnerability - username not sanitized",
      fix: 'query = "SELECT * FROM users WHERE username = ?" then db.execute(query, (username,))',
    },
    difficulty: "hard",
  },
];

/**
 * Get a random challenge for the specified difficulty
 */
export function getRandomChallenge(
  difficulty: "easy" | "standard" | "hard" = "standard"
): ReasoningChallenge {
  const filtered = reasoningChallenges.filter((c) => c.difficulty === difficulty);
  const index = Math.floor(Math.random() * filtered.length);
  return filtered[index];
}

/**
 * Validate an agent's answer to a reasoning challenge
 */
export function validateReasoningAnswer(
  challenge: ReasoningChallenge,
  answer: { line: number; issue: string; fix?: string }
): { passed: boolean; error?: string } {
  // Check line number (allow +/- 1 tolerance)
  if (Math.abs(answer.line - challenge.answer.line) > 1) {
    return {
      passed: false,
      error: `Incorrect line number. Expected around line ${challenge.answer.line}`,
    };
  }

  // Check if issue description contains key terms
  const issueKeywords = challenge.answer.issue.toLowerCase().split(" ");
  const answerIssue = answer.issue.toLowerCase();
  
  // Need at least 2 matching keywords
  const matchingKeywords = issueKeywords.filter(
    (kw) => kw.length > 3 && answerIssue.includes(kw)
  );
  
  if (matchingKeywords.length < 2) {
    return {
      passed: false,
      error: "Issue description does not match the actual bug",
    };
  }

  return { passed: true };
}
