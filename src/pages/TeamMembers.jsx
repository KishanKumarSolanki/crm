import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Link } from "react-router-dom"

export default function TeamMembers() {
    const [members, setMembers] = useState([])
    const [showForm, setShowForm] = useState(false)

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [phone, setPhone] = useState("")
    const [designation, setDesignation] = useState("")

    const [loading, setLoading] = useState(false)

    // Fetch team members
    const fetchMembers = async () => {
        const { data, error } = await supabase
            .from("team_members")
            .select("*")
            .order("created_at", { ascending: false })

        if (error) {
            console.error(error)
            alert(error.message)
            return
        }

        setMembers(data || [])
    }

    useEffect(() => {
        fetchMembers()
    }, [])

    // Add member
    const handleAddMember = async (e) => {
        e.preventDefault()

        if (!name.trim()) {
            alert("Please enter member name")
            return
        }

        setLoading(true)

        const { error } = await supabase
            .from("team_members")
            .insert([
                {
                    name: name.trim(),
                    email: email.trim(),
                    phone: phone.trim(),
                    designation: designation.trim(),
                    status: "active"
                }
            ])

        if (error) {
            console.error(error)
            alert(error.message)
        } else {
            alert("Team member added successfully")

            setName("")
            setEmail("")
            setPhone("")
            setDesignation("")

            setShowForm(false)

            fetchMembers()
        }

        setLoading(false)
    }

    // Delete member
    const handleDelete = async (id) => {
        const confirmDelete = window.confirm(
            "Are you sure you want to delete this team member?"
        )

        if (!confirmDelete) return

        const { error } = await supabase
            .from("team_members")
            .delete()
            .eq("id", id)

        if (error) {
            alert(error.message)
            return
        }

        fetchMembers()
    }

    return (
        <div style={{ padding: "30px" }}>

            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "30px"
                }}
            >
                <div>
                    <h1 style={{ marginBottom: "5px" }}>
                        Team Members
                    </h1>

                    <p style={{ margin: 0, color: "#666" }}>
                        Manage your team members
                    </p>
                </div>

                <button
                    onClick={() => setShowForm(!showForm)}
                    style={{
                        padding: "10px 18px",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer"
                    }}
                >
                    {showForm ? "Close" : "+ Add Member"}
                </button>
            </div>

            {/* Add Member Form */}
            {showForm && (
                <form
                    onSubmit={handleAddMember}
                    style={{
                        border: "1px solid #ddd",
                        borderRadius: "12px",
                        padding: "20px",
                        marginBottom: "30px",
                        maxWidth: "600px"
                    }}
                >
                    <h2>Add Team Member</h2>

                    <div style={{ marginBottom: "15px" }}>
                        <label>Name</label>

                        <input
                            type="text"
                            placeholder="Enter name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px",
                                marginTop: "5px"
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: "15px" }}>
                        <label>Email</label>

                        <input
                            type="email"
                            placeholder="Enter email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px",
                                marginTop: "5px"
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: "15px" }}>
                        <label>Phone</label>

                        <input
                            type="text"
                            placeholder="Enter phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px",
                                marginTop: "5px"
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: "15px" }}>
                        <label>Designation</label>

                        <input
                            type="text"
                            placeholder="e.g. Sales Executive"
                            value={designation}
                            onChange={(e) => setDesignation(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px",
                                marginTop: "5px"
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: "10px 18px",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer"
                        }}
                    >
                        {loading ? "Adding..." : "Add Member"}
                    </button>
                </form>
            )}

            {/* Members Table */}
            <div
                style={{
                    border: "1px solid #ddd",
                    borderRadius: "12px",
                    overflow: "hidden"
                }}
            >
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "collapse"
                    }}
                >
                    <thead>
                        <tr>
                            <th style={{ padding: "14px", textAlign: "left" }}>
                                Name
                            </th>

                            <th style={{ padding: "14px", textAlign: "left" }}>
                                Email
                            </th>

                            <th style={{ padding: "14px", textAlign: "left" }}>
                                Phone
                            </th>

                            <th style={{ padding: "14px", textAlign: "left" }}>
                                Designation
                            </th>

                            <th style={{ padding: "14px", textAlign: "left" }}>
                                Status
                            </th>

                            <th style={{ padding: "14px", textAlign: "left" }}>
                                Action
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {members.length === 0 ? (
                            <tr>
                                <td
                                    colSpan="6"
                                    style={{
                                        padding: "30px",
                                        textAlign: "center"
                                    }}
                                >
                                    No team members found.
                                </td>
                            </tr>
                        ) : (
                            members.map((member) => (
                                <tr key={member.id}>

                                    <td style={{ padding: "14px" }}>
                                        <Link
                                            to={`/team-member/${member.id}`}
                                            style={{
                                                textDecoration: "none",
                                                fontWeight: "600"
                                            }}
                                        >
                                            {member.name}
                                        </Link>
                                    </td>

                                    <td style={{ padding: "14px" }}>
                                        {member.email || "-"}
                                    </td>

                                    <td style={{ padding: "14px" }}>
                                        {member.phone || "-"}
                                    </td>

                                    <td style={{ padding: "14px" }}>
                                        {member.designation || "-"}
                                    </td>

                                    <td style={{ padding: "14px" }}>
                                        {member.status}
                                    </td>

                                    <td style={{ padding: "14px" }}>
                                        <button
                                            onClick={() => handleDelete(member.id)}
                                            style={{
                                                padding: "7px 12px",
                                                border: "none",
                                                borderRadius: "6px",
                                                cursor: "pointer"
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </td>

                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    )
}