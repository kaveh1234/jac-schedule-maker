import re
import json

def parse_time(time_str):
    """Parse time string like '0830-1030' into start and end times."""
    match = re.match(r'(\d{4})-(\d{4})', time_str)
    if match:
        return {'start': match.group(1), 'end': match.group(2)}
    return None

def parse_days(day_str):
    """Parse day string like 'TF' or 'MWF' into list of days."""
    day_map = {'M': 'Monday', 'T': 'Tuesday', 'W': 'Wednesday', 'R': 'Thursday', 'F': 'Friday'}
    days = []
    for char in day_str:
        if char in day_map:
            days.append(day_map[char])
    return days

def parse_schedule():
    with open('extracted_schedule.txt', 'r', encoding='latin-1') as f:
        content = f.read()

    courses = []
    current_section = None
    current_course_code = None
    current_course_title = None
    current_department = None

    lines = content.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        # Skip page headers and empty lines
        if line.startswith('=== PAGE') or line.startswith('SCHEDULE OF CLASSES') or line.startswith('John Abbott College') or not line:
            i += 1
            continue

        # Detect department headers (all caps, single word or two words)
        if re.match(r'^(BIOLOGY|CHEMISTRY|PHYSICS|MATHEMATICS|ENGLISH|FRENCH|HUMANITIES|PHYSICAL EDUCATION|COMPUTER SCIENCE|PSYCHOLOGY|PHILOSOPHY|HISTORY|ECONOMICS|GEOGRAPHY|SOCIOLOGY|POLITICAL SCIENCE|ART|MUSIC|THEATRE|CINEMA|COMMUNICATION|ACCOUNTING|BUSINESS|NURSING|SOCIAL SCIENCE|QUANTITATIVE METHODS|COMPLEMENTARY)$', line, re.IGNORECASE):
            current_department = line
            i += 1
            continue

        # Skip category headers like "Science Courses"
        if 'Courses' in line and len(line.split()) <= 3:
            i += 1
            continue

        # Skip header lines
        if line.startswith('SECTION DISC'):
            i += 1
            continue

        # Detect section number (5 digits at start of line)
        section_match = re.match(r'^(\d{5})\s+(\w+)\s+(\S+)\s+(.+?)\s+([MTWRF]+)\s+(\d{4}-\d{4})', line)
        if section_match:
            section_num = section_match.group(1)
            discipline = section_match.group(2)
            course_code = section_match.group(3)
            rest = section_match.group(4)
            days = section_match.group(5)
            times = section_match.group(6)

            # Extract course title from rest
            course_title = rest.strip()

            current_section = {
                'section': section_num,
                'discipline': discipline,
                'course_code': course_code,
                'course_title': course_title,
                'department': current_department,
                'components': []
            }

            # Check next line for type and teacher
            i += 1
            if i < len(lines):
                next_line = lines[i].strip()
                type_match = re.match(r'^(Lecture|Laboratory|Fieldwork|Tutorial|Stage|Seminar)\s+(.+)', next_line)
                if type_match:
                    component_type = type_match.group(1)
                    teacher = type_match.group(2).strip()

                    current_section['components'].append({
                        'type': component_type,
                        'teacher': teacher,
                        'days': parse_days(days),
                        'time': parse_time(times)
                    })
                    i += 1

            # Continue reading more components for this section
            while i < len(lines):
                line = lines[i].strip()

                # Check for continuation component (no section number)
                comp_match = re.match(r'^(\w+)\s+(\S+)\s+(.+?)\s+([MTWRF]+)\s+(\d{4}-\d{4})', line)
                if comp_match and not re.match(r'^\d{5}', line):
                    days = comp_match.group(4)
                    times = comp_match.group(5)

                    i += 1
                    if i < len(lines):
                        next_line = lines[i].strip()
                        type_match = re.match(r'^(Lecture|Laboratory|Fieldwork|Tutorial|Stage|Seminar)\s+(.+)', next_line)
                        if type_match:
                            component_type = type_match.group(1)
                            teacher = type_match.group(2).strip()

                            current_section['components'].append({
                                'type': component_type,
                                'teacher': teacher,
                                'days': parse_days(days),
                                'time': parse_time(times)
                            })
                            i += 1
                            continue
                    break
                elif re.match(r'^(For .+|This course|Co-requisite|Prerequisite|Note:)', line):
                    # Skip note lines
                    i += 1
                    continue
                else:
                    break

            if current_section['components']:
                courses.append(current_section)
            continue

        i += 1

    return courses

def main():
    courses = parse_schedule()

    # Group by course
    course_groups = {}
    for section in courses:
        key = f"{section['discipline']} {section['course_code']}"
        if key not in course_groups:
            course_groups[key] = {
                'course_code': section['course_code'],
                'discipline': section['discipline'],
                'course_title': section['course_title'],
                'department': section['department'],
                'sections': []
            }
        course_groups[key]['sections'].append({
            'section': section['section'],
            'components': section['components']
        })

    # Get all unique teachers
    teachers = set()
    for section in courses:
        for comp in section['components']:
            teachers.add(comp['teacher'])

    output = {
        'courses': list(course_groups.values()),
        'teachers': sorted(list(teachers))
    }

    with open('schedule_data.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)

    print(f"Parsed {len(courses)} sections into {len(course_groups)} courses")
    print(f"Found {len(teachers)} unique teachers")

if __name__ == '__main__':
    main()
