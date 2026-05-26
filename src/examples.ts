import type { ExampleProgram } from './types';
import type { Language } from './types';

export interface Example extends ExampleProgram {
  lang: Language;
}

// ─── Python ────────────────────────────────────────────────────────────────
const PYTHON_EXAMPLES: Example[] = [
  {
    id: 'py_factorial', lang: 'python',
    name: 'Factorial (recursive)',
    hint: 'Watch the call stack grow and shrink as recursion unwinds',
    code: `# Watch the call stack grow and shrink as recursion unwinds

def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

result = factorial(5)
print(result)
`,
  },
  {
    id: 'py_fibonacci', lang: 'python',
    name: 'Fibonacci (recursive)',
    hint: 'Notice how each call spawns two more — exponential stack depth',
    code: `# Notice how each call spawns two more — exponential stack depth

def fib(n):
    if n <= 1:
        return n
    a = fib(n - 1)
    b = fib(n - 2)
    return a + b

result = fib(6)
print(result)
`,
  },
  {
    id: 'py_bubble_sort', lang: 'python',
    name: 'Bubble Sort',
    hint: 'Watch adjacent elements swap as the largest bubble to the top',
    code: `# Watch adjacent elements swap as the largest bubbles to the top

def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

data = [64, 34, 25, 12, 22, 11, 90]
sorted_data = bubble_sort(data)
print(sorted_data)
`,
  },
  {
    id: 'py_linked_list', lang: 'python',
    name: 'Linked List Reversal',
    hint: 'Watch heap objects relink — pointers flip one by one',
    code: `# Watch heap objects relink — pointers flip one by one

class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

def reverse(head):
    prev = None
    curr = head
    while curr is not None:
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt
    return prev

head = Node(1)
head.next = Node(2)
head.next.next = Node(3)
head.next.next.next = Node(4)

new_head = reverse(head)
`,
  },
  {
    id: 'py_vector_ops', lang: 'python',
    name: 'Vector Insert / Delete',
    hint: 'Insert shifts elements right; delete shifts left — watch the array cells animate',
    code: `# Insert shifts elements right; removal shifts elements left
# Watch the array cells on the heap update live at each step

data = [10, 20, 30, 40, 50]

# INSERT 99 at index 2 — elements 30,40,50 slide right
data.insert(2, 99)

# REMOVE element at index 2 — slides back
data.pop(2)

# INSERT at head — every element shifts right (most expensive!)
data.insert(0, 5)

# REMOVE from head — every element shifts left
data.pop(0)
`,
  },
  {
    id: 'py_ll_insert_delete', lang: 'python',
    name: 'Linked List Insert / Delete',
    hint: 'Watch exactly two pointer fields rewire for insert — zero shifting needed',
    code: `# Watch pointer arrows rewire — one field at a time
# Insert/delete only needs O(1) pointer updates, no shifting

class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

# Build: 1 -> 2 -> 3 -> 4
head = Node(1)
head.next = Node(2)
head.next.next = Node(3)
head.next.next.next = Node(4)

# INSERT 99 after node-2 — only 2 pointer writes
prev = head.next          # prev points at node-2
ins = Node(99)
ins.next = prev.next      # step 1: ins -> 3 -> 4
prev.next = ins           # step 2: 1 -> 2 -> 99 -> 3 -> 4

# DELETE ins (node-99) — only 1 pointer write
prev.next = ins.next      # 1 -> 2 -> 3 -> 4
`,
  },
];

// ─── C++ ───────────────────────────────────────────────────────────────────
const CPP_EXAMPLES: Example[] = [
  {
    id: 'cpp_copy_ctor', lang: 'cpp',
    name: 'Copy Constructor Trap',
    hint: 'Each call receives a fresh heap copy of Point — watch copies pile up and the stack deepen. In real C++, MyClass(MyClass other) recurses infinitely before the body ever runs.',
    code: `// COPY CONSTRUCTOR: By-Value Causes Infinite Recursion
//
// ✗ WRONG   — MyClass(MyClass other)
//   To call this, C++ must copy the argument into 'other',
//   which calls the copy constructor again to copy it... forever.
//   The body never even executes. Compiler rejects this.
//
// ✓ CORRECT — MyClass(const MyClass& other)
//   Just a reference alias — no copy made, no recursion.
//
// Simulation below: each call gets a NEW copy of Point on the heap.
// Watch the heap grow (one new Point per call) and the stack deepen.
#include <iostream>
using namespace std;

struct Point {
    int x;
    int y;
};

// Simulates MyClass(MyClass other): every call copies 'p' by value,
// then immediately passes 'p' by value again → another copy → another call.
// In real C++, this loop starts at the call site, not inside the body.
Point copyCtor(Point p, int depth) {
    cout << "copy #" << depth << "  x=" << p.x << endl;
    if (depth >= 4) return p;        // real C++: stack overflow here
    return copyCtor(p, depth + 1);  // p passed by value → triggers a copy
}

int main() {
    Point a;
    a.x = 7;
    a.y = 3;
    // copyCtor(a,1) copies a → copyCtor copies again → ... stack overflow
    Point b = copyCtor(a, 1);
    cout << "done. x=" << b.x << endl;
    return 0;
}
`,
  },
  {
    id: 'cpp_factorial', lang: 'cpp',
    name: 'Factorial (recursive)',
    hint: 'Watch the call stack grow and shrink as recursion unwinds',
    code: `// Watch the call stack grow and shrink as recursion unwinds
#include <iostream>
using namespace std;

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    int result = factorial(5);
    cout << result << endl;
    return 0;
}
`,
  },
  {
    id: 'cpp_fibonacci', lang: 'cpp',
    name: 'Fibonacci (recursive)',
    hint: 'Each call fans into two — watch the stack cascade',
    code: `// Each call fans into two — watch the stack cascade
#include <iostream>
using namespace std;

int fib(int n) {
    if (n <= 1) return n;
    int a = fib(n - 1);
    int b = fib(n - 2);
    return a + b;
}

int main() {
    int result = fib(6);
    cout << result << endl;
    return 0;
}
`,
  },
  {
    id: 'cpp_bubble_sort', lang: 'cpp',
    name: 'Bubble Sort',
    hint: 'Watch array elements swap in-place via index access',
    code: `// Watch array elements swap in-place via index access
#include <iostream>
using namespace std;

void bubbleSort(int arr[], int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

int main() {
    int arr[] = {64, 34, 25, 12, 22};
    int n = 5;
    bubbleSort(arr, n);
    for (int i = 0; i < n; i++) {
        cout << arr[i] << " ";
    }
    cout << endl;
    return 0;
}
`,
  },
  {
    id: 'cpp_linked_list', lang: 'cpp',
    name: 'Linked List Reversal',
    hint: 'Heap structs relink via pointer reassignment — watch the arrows flip',
    code: `// Heap structs relink via pointer reassignment — watch the arrows flip
#include <iostream>
using namespace std;

struct Node {
    int val;
    Node* next;
};

Node* reverse(Node* head) {
    Node* prev = nullptr;
    Node* curr = head;
    while (curr != nullptr) {
        Node* nxt = curr->next;
        curr->next = prev;
        prev = curr;
        curr = nxt;
    }
    return prev;
}

int main() {
    Node* head = new Node{1, nullptr};
    head->next = new Node{2, nullptr};
    head->next->next = new Node{3, nullptr};
    head->next->next->next = new Node{4, nullptr};
    head = reverse(head);
    return 0;
}
`,
  },
  {
    id: 'cpp_vector_ops', lang: 'cpp',
    name: 'Vector Insert / Delete',
    hint: 'Insert shifts elements right; delete shifts left — watch cells animate in the array band',
    code: `// Insert shifts elements right; removal shifts elements left
// Extra slots pre-allocated so insertion doesn't overflow
#include <iostream>
using namespace std;

int main() {
    int arr[] = {10, 20, 30, 40, 50, 0, 0, 0};
    int size = 5;

    // INSERT 99 at index 2 — shift elements right
    int idx = 2;
    for (int i = size; i > idx; i--) {
        arr[i] = arr[i - 1];
    }
    arr[idx] = 99;
    size++;

    // REMOVE element at index 2 — shift elements left
    for (int i = idx; i < size - 1; i++) {
        arr[i] = arr[i + 1];
    }
    size--;

    return 0;
}
`,
  },
  {
    id: 'cpp_ll_insert_delete', lang: 'cpp',
    name: 'Linked List Insert / Delete',
    hint: 'Watch exactly two pointer fields rewire for insert — no shifting, just pointer updates',
    code: `// Insert/delete only rewires pointers — O(1) work, no shifting
#include <iostream>
using namespace std;

struct Node { int val; Node* next; };

int main() {
    // Build 1 -> 2 -> 3 -> 4
    Node* head = new Node{1, nullptr};
    head->next = new Node{2, nullptr};
    head->next->next = new Node{3, nullptr};
    head->next->next->next = new Node{4, nullptr};

    // INSERT 99 after node-2 — only 2 pointer writes
    Node* prev = head->next;        // prev -> node-2
    Node* ins = new Node{99, nullptr};
    ins->next = prev->next;         // step 1: ins -> 3 -> 4
    prev->next = ins;               // step 2: 1 -> 2 -> 99 -> 3 -> 4

    // DELETE ins (node-99) — only 1 pointer write
    prev->next = ins->next;         // 1 -> 2 -> 3 -> 4

    return 0;
}
`,
  },
];

// ─── Java ──────────────────────────────────────────────────────────────────
const JAVA_EXAMPLES: Example[] = [
  {
    id: 'java_factorial', lang: 'java',
    name: 'Factorial (recursive)',
    hint: 'Watch the call stack grow and shrink as recursion unwinds',
    code: `// Watch the call stack grow and shrink as recursion unwinds
public class Main {
    static int factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }

    public static void main(String[] args) {
        int result = factorial(5);
        System.out.println(result);
    }
}
`,
  },
  {
    id: 'java_fibonacci', lang: 'java',
    name: 'Fibonacci (recursive)',
    hint: 'Each call fans into two — watch the stack cascade',
    code: `// Each call fans into two — watch the stack cascade
public class Main {
    static int fib(int n) {
        if (n <= 1) return n;
        int a = fib(n - 1);
        int b = fib(n - 2);
        return a + b;
    }

    public static void main(String[] args) {
        int result = fib(6);
        System.out.println(result);
    }
}
`,
  },
  {
    id: 'java_bubble_sort', lang: 'java',
    name: 'Bubble Sort',
    hint: 'Watch array elements swap — the heap array updates live',
    code: `// Watch array elements swap — the heap array updates live
public class Main {
    static void bubbleSort(int[] arr) {
        int n = arr.length;
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n - i - 1; j++) {
                if (arr[j] > arr[j + 1]) {
                    int temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }
    }

    public static void main(String[] args) {
        int[] data = {64, 34, 25, 12, 22};
        bubbleSort(data);
        for (int i = 0; i < data.length; i++) {
            System.out.print(data[i] + " ");
        }
        System.out.println();
    }
}
`,
  },
  {
    id: 'java_linked_list', lang: 'java',
    name: 'Linked List Reversal',
    hint: 'Object references relink on the heap — watch next pointers flip',
    code: `// Object references relink on the heap — watch next pointers flip
public class Main {
    static class Node {
        int val;
        Node next;
        Node(int v) {
            this.val = v;
            this.next = null;
        }
    }

    static Node reverse(Node head) {
        Node prev = null;
        Node curr = head;
        while (curr != null) {
            Node nxt = curr.next;
            curr.next = prev;
            prev = curr;
            curr = nxt;
        }
        return prev;
    }

    public static void main(String[] args) {
        Node head = new Node(1);
        head.next = new Node(2);
        head.next.next = new Node(3);
        head.next.next.next = new Node(4);
        head = reverse(head);
    }
}
`,
  },
  {
    id: 'java_vector_ops', lang: 'java',
    name: 'Vector Insert / Delete',
    hint: 'Insert shifts elements right; delete shifts left — watch cells animate in the array band',
    code: `// Insert shifts elements right; removal shifts elements left
// Extra slots pre-allocated so insertion doesn't overflow
public class Main {
    public static void main(String[] args) {
        int[] arr = {10, 20, 30, 40, 50, 0, 0, 0};
        int size = 5;

        // INSERT 99 at index 2 — shift elements right
        int idx = 2;
        for (int i = size; i > idx; i--) {
            arr[i] = arr[i - 1];
        }
        arr[idx] = 99;
        size++;

        // REMOVE element at index 2 — shift elements left
        for (int i = idx; i < size - 1; i++) {
            arr[i] = arr[i + 1];
        }
        size--;
    }
}
`,
  },
  {
    id: 'java_ll_insert_delete', lang: 'java',
    name: 'Linked List Insert / Delete',
    hint: 'Watch exactly two pointer fields rewire for insert — no shifting, just pointer updates',
    code: `// Insert/delete only rewires pointers — O(1) work, no shifting
public class Main {
    static class Node {
        int val;
        Node next;
        Node(int v) { this.val = v; this.next = null; }
    }

    public static void main(String[] args) {
        // Build 1 -> 2 -> 3 -> 4
        Node head = new Node(1);
        head.next = new Node(2);
        head.next.next = new Node(3);
        head.next.next.next = new Node(4);

        // INSERT 99 after node-2 — only 2 pointer writes
        Node prev = head.next;       // prev points to node-2
        Node ins = new Node(99);
        ins.next = prev.next;        // step 1: ins -> 3 -> 4
        prev.next = ins;             // step 2: 1 -> 2 -> 99 -> 3 -> 4

        // DELETE ins (node-99) — only 1 pointer write
        prev.next = ins.next;        // 1 -> 2 -> 3 -> 4
    }
}
`,
  },
];

export const EXAMPLES: Example[] = [
  ...PYTHON_EXAMPLES,
  ...CPP_EXAMPLES,
  ...JAVA_EXAMPLES,
];

export const EXAMPLES_BY_LANG: Record<Language, Example[]> = {
  python: PYTHON_EXAMPLES,
  cpp: CPP_EXAMPLES,
  java: JAVA_EXAMPLES,
};
